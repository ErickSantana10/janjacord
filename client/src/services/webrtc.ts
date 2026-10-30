import { Socket } from 'socket.io-client';
import {
  QUALITY_PRESETS,
  DEFAULT_AUDIO_SETTINGS,
  type StreamQualityPreset,
  type AudioSettings,
} from '../types';

export class WebRTCManager {
  private socket: Socket;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private makingOffer: Map<string, boolean> = new Map();
  private ignoreOffer: Map<string, boolean> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();

  private rawMicStream: MediaStream | null = null;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private rawScreenStream: MediaStream | null = null;
  private isMuted: boolean = false;

  private audioSettings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };

  private audioContext: AudioContext | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private micGainNode: GainNode | null = null;
  private micDestinationNode: MediaStreamAudioDestinationNode | null = null;
  private analyser: AnalyserNode | null = null;
  private speakingInterval: number | null = null;

  // Anti-Eco e Detector de Fala Remota
  private remoteVoiceAnalysers: Map<string, { source: MediaStreamAudioSourceNode; analyser: AnalyserNode }> =
    new Map();
  private screenAudioGainNode: GainNode | null = null;
  private antiEchoInterval: number | null = null;
  private remoteSpeakingInterval: number | null = null;
  private lastRemoteSpeakingKey: string = '';

  public onSpeakingChange?: (isSpeaking: boolean) => void;
  public onRemoteSpeakingChange?: (speakingPeerIds: string[]) => void;
  public onMicLevelChange?: (level: number) => void;
  public onRemoteStream?: (peerId: string, stream: MediaStream, isScreen: boolean) => void;
  public onRemoteScreenRemoved?: (peerId: string) => void;
  public onPeerDisconnected?: (peerId: string) => void;
  public onScreenShareEnded?: () => void;

  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
    iceCandidatePoolSize: 10,
  };

  constructor(socket: Socket, initialAudioSettings?: AudioSettings) {
    this.socket = socket;
    if (initialAudioSettings) {
      this.audioSettings = { ...initialAudioSettings };
    }
    this.setupSignaling();
    this.startRemoteSpeakingMonitor();
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  private async flushPendingCandidates(peerId: string, pc: RTCPeerConnection) {
    const queue = this.pendingCandidates.get(peerId);
    if (!queue || queue.length === 0) return;
    this.pendingCandidates.set(peerId, []);
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignora candidato obsoleto
      }
    }
  }

  private setupSignaling() {
    this.socket.on('webrtc:offer', async (payload: { fromSocketId?: string; fromPeerId?: string; offer: RTCSessionDescriptionInit }) => {
      const fromId = payload.fromSocketId || payload.fromPeerId;
      const offer = payload.offer;
      if (!fromId || !offer) return;

      try {
        const pc = this.getOrCreatePeerConnection(fromId);
        const isPolite = (this.socket.id || '') < fromId;
        const offerCollision = this.makingOffer.get(fromId) || pc.signalingState !== 'stable';

        this.ignoreOffer.set(fromId, !isPolite && offerCollision);
        if (this.ignoreOffer.get(fromId)) {
          return;
        }

        if (offerCollision) {
          await Promise.all([
            pc.setLocalDescription({ type: 'rollback' }),
            pc.setRemoteDescription(new RTCSessionDescription(offer)),
          ]);
        } else {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
        }

        await this.flushPendingCandidates(fromId, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.socket.emit('webrtc:answer', {
          targetSocketId: fromId,
          toPeerId: fromId,
          answer: pc.localDescription || answer,
        });

        // Se estivermos compartilhando tela e o offer recebido do colega não tinha linha de vídeo,
        // renegociamos em seguida para empurrar nossa transmissão de tela para ele!
        if (this.screenStream && (!offer.sdp || !offer.sdp.includes('m=video'))) {
          setTimeout(() => {
            if (pc.signalingState === 'stable') {
              this.renegotiate(fromId, pc);
            }
          }, 250);
        }
      } catch (err) {
        console.warn('[WebRTC] Erro ao processar offer:', err);
      }
    });

    this.socket.on('webrtc:answer', async (payload: { fromSocketId?: string; fromPeerId?: string; answer: RTCSessionDescriptionInit }) => {
      const fromId = payload.fromSocketId || payload.fromPeerId;
      const answer = payload.answer;
      if (!fromId || !answer) return;

      try {
        const pc = this.peerConnections.get(fromId);
        if (pc && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await this.flushPendingCandidates(fromId, pc);
        }
      } catch (err) {
        console.warn('[WebRTC] Erro ao processar answer:', err);
      }
    });

    this.socket.on('webrtc:ice-candidate', async (payload: { fromSocketId?: string; fromPeerId?: string; candidate: RTCIceCandidateInit }) => {
      const fromId = payload.fromSocketId || payload.fromPeerId;
      const candidate = payload.candidate;
      if (!fromId || !candidate) return;

      try {
        if (this.ignoreOffer.get(fromId)) return;
        const pc = this.getOrCreatePeerConnection(fromId);
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          const list = this.pendingCandidates.get(fromId) || [];
          list.push(candidate);
          this.pendingCandidates.set(fromId, list);
        }
      } catch {
        // Ignora candidatos ICE obsoletos durante renegociação
      }
    });

    this.socket.on('voice:peer-left', (payload: { socketId?: string; peerId?: string }) => {
      const leftId = payload.socketId || payload.peerId;
      if (!leftId) return;
      this.closePeerConnection(leftId);
      this.onPeerDisconnected?.(leftId);
    });
  }

  public async connectToPeer(targetSocketId: string) {
    if (!targetSocketId || targetSocketId === this.socket.id) return;
    const pc = this.getOrCreatePeerConnection(targetSocketId);

    // Garante que mesmo sem microfone local o SDP peça recebimento de áudio e vídeo
    if (pc.getTransceivers().length === 0) {
      try {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
        pc.addTransceiver('video', { direction: 'recvonly' });
      } catch {}
    }

    await this.renegotiate(targetSocketId, pc);
  }

  private startRemoteSpeakingMonitor() {
    if (this.remoteSpeakingInterval) clearInterval(this.remoteSpeakingInterval);
    const freqData = new Uint8Array(128);

    this.remoteSpeakingInterval = window.setInterval(() => {
      if (this.remoteVoiceAnalysers.size === 0) {
        if (this.lastRemoteSpeakingKey !== '') {
          this.lastRemoteSpeakingKey = '';
          this.onRemoteSpeakingChange?.([]);
        }
        return;
      }

      const speakingPeers: string[] = [];
      for (const [peerId, { analyser }] of this.remoteVoiceAnalysers.entries()) {
        analyser.getByteFrequencyData(freqData);
        let sum = 0;
        for (let i = 0; i < freqData.length; i++) sum += freqData[i];
        const avg = sum / freqData.length;
        if (avg > 12) {
          speakingPeers.push(peerId);
        }
      }

      const key = speakingPeers.sort().join(',');
      if (key !== this.lastRemoteSpeakingKey) {
        this.lastRemoteSpeakingKey = key;
        this.onRemoteSpeakingChange?.(speakingPeers);
      }
    }, 100);
  }

  private registerRemoteVoiceForAntiEcho(peerId: string, stream: MediaStream) {
    try {
      if (stream.getAudioTracks().length === 0) return;
      const ctx = this.getAudioContext();
      const existing = this.remoteVoiceAnalysers.get(peerId);
      if (existing) {
        try {
          existing.source.disconnect();
        } catch {}
      }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      this.remoteVoiceAnalysers.set(peerId, { source, analyser });
    } catch {
      // Ignora caso o stream ainda não possua áudio ativo
    }
  }

  private getOrCreatePeerConnection(peerId: string): RTCPeerConnection {
    if (this.peerConnections.has(peerId)) {
      return this.peerConnections.get(peerId)!;
    }

    const pc = new RTCPeerConnection(this.rtcConfig);
    this.peerConnections.set(peerId, pc);

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        const already = pc.getSenders().some((s) => s.track === track);
        if (!already) {
          pc.addTrack(track, this.localStream!);
        }
      });
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => {
        const already = pc.getSenders().some((s) => s.track === track);
        if (!already) {
          pc.addTrack(track, this.screenStream!);
        }
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('webrtc:ice-candidate', {
          targetSocketId: peerId,
          toPeerId: peerId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      const isScreen = event.track.kind === 'video' || remoteStream.getVideoTracks().length > 0;
      this.onRemoteStream?.(peerId, remoteStream, isScreen);

      if (!isScreen && event.track.kind === 'audio') {
        this.registerRemoteVoiceForAntiEcho(peerId, remoteStream);
      }

      if (event.track.kind === 'video') {
        event.track.onended = () => {
          this.onRemoteScreenRemoved?.(peerId);
        };
        event.track.onmute = () => {
          if (remoteStream.getVideoTracks().every((t) => t.readyState === 'ended' || t.muted)) {
            setTimeout(() => {
              if (remoteStream.getVideoTracks().every((t) => t.readyState === 'ended' || t.muted)) {
                this.onRemoteScreenRemoved?.(peerId);
              }
            }, 900);
          }
        };
        event.track.onunmute = () => {
          this.onRemoteStream?.(peerId, remoteStream, true);
        };
      }

      remoteStream.onaddtrack = (e) => {
        const nowHasVideo = e.track.kind === 'video' || remoteStream.getVideoTracks().length > 0;
        this.onRemoteStream?.(peerId, remoteStream, nowHasVideo);
      };

      remoteStream.onremovetrack = (e) => {
        if (e.track.kind === 'video' && remoteStream.getVideoTracks().length === 0) {
          this.onRemoteScreenRemoved?.(peerId);
        }
      };
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        // Tenta reiniciar o ICE automaticamente se falhar na primeira tentativa
        try {
          pc.restartIce();
          this.renegotiate(peerId, pc);
        } catch {}
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closePeerConnection(peerId);
        this.onPeerDisconnected?.(peerId);
      }
    };

    return pc;
  }

  private buildAudioConstraints(): MediaTrackConstraints {
    const s = this.audioSettings;
    const isIsolation = s.inputProfile === 'isolation';
    const isStudio = s.inputProfile === 'studio';

    const constraints: MediaTrackConstraints = {
      echoCancellation: isIsolation ? true : isStudio ? false : s.echoCancellation,
      noiseSuppression: isIsolation ? true : isStudio ? false : s.noiseSuppression,
      autoGainControl: isIsolation ? true : isStudio ? false : s.autoGainControl,
      channelCount: isStudio ? 2 : 1,
      sampleRate: 48000,
    };

    if (s.inputDeviceId && s.inputDeviceId !== 'default') {
      constraints.deviceId = { ideal: s.inputDeviceId };
    }

    return constraints;
  }

  public async startMicrophone(): Promise<MediaStream> {
    if (this.localStream && this.localStream.getAudioTracks().some((t) => t.readyState === 'live')) {
      return this.localStream;
    }

    try {
      this.rawMicStream = await navigator.mediaDevices.getUserMedia({
        audio: this.buildAudioConstraints(),
        video: false,
      });
    } catch {
      // Fallback com constraints básicos caso o dispositivo selecionado não esteja disponível
      this.rawMicStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
    }

    this.setupMicProcessingPipeline(this.rawMicStream);

    for (const [peerId, pc] of this.peerConnections.entries()) {
      const audioTrack = this.localStream?.getAudioTracks()[0];
      if (audioTrack && this.localStream) {
        const existingAudioSender = pc
          .getSenders()
          .find((s) => s.track && s.track.kind === 'audio' && s.track !== this.screenStream?.getAudioTracks()[0]);
        if (existingAudioSender) {
          await existingAudioSender.replaceTrack(audioTrack);
        } else {
          pc.addTrack(audioTrack, this.localStream);
          await this.renegotiate(peerId, pc);
        }
      }
    }

    return this.localStream!;
  }

  private setupMicProcessingPipeline(rawStream: MediaStream) {
    try {
      const ctx = this.getAudioContext();

      if (this.micSourceNode) {
        try {
          this.micSourceNode.disconnect();
        } catch {}
      }

      this.micSourceNode = ctx.createMediaStreamSource(rawStream);
      if (!this.micGainNode) {
        this.micGainNode = ctx.createGain();
      }
      this.micGainNode.gain.value = this.isMuted ? 0 : this.audioSettings.inputVolume / 100;

      if (!this.analyser) {
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 256;
      }

      if (!this.micDestinationNode) {
        this.micDestinationNode = ctx.createMediaStreamDestination();
      }

      this.micSourceNode.connect(this.analyser);
      this.micSourceNode.connect(this.micGainNode);
      this.micGainNode.connect(this.micDestinationNode);

      this.localStream = this.micDestinationNode.stream;
      this.localStream.getAudioTracks().forEach((t) => {
        t.enabled = !this.isMuted;
      });

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      let lastState = false;

      if (this.speakingInterval) clearInterval(this.speakingInterval);
      this.speakingInterval = window.setInterval(() => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const average = sum / dataArray.length;

        this.onMicLevelChange?.(Math.min(100, Math.round((average / 65) * 100)));

        const threshold = this.audioSettings.autoSensitivity ? 14 : this.audioSettings.sensitivityThreshold;
        const isSpeaking = !this.isMuted && average > threshold;

        // Se a sensibilidade manual estiver ativa, atua como Noise Gate cortando ruído abaixo do limite
        if (this.micGainNode && this.audioContext) {
          const baseGain = this.isMuted ? 0 : this.audioSettings.inputVolume / 100;
          const targetGain =
            this.isMuted || (!this.audioSettings.autoSensitivity && !isSpeaking) ? 0 : baseGain;
          this.micGainNode.gain.setTargetAtTime(targetGain, this.audioContext.currentTime, 0.015);
        }

        if (isSpeaking !== lastState) {
          lastState = isSpeaking;
          this.onSpeakingChange?.(isSpeaking);
        }
      }, 80);
    } catch (e) {
      console.warn('Fallback para stream de microfone direto:', e);
      this.localStream = rawStream;
      this.localStream.getAudioTracks().forEach((t) => {
        t.enabled = !this.isMuted;
      });
    }
  }

  public async updateAudioSettings(newSettings: AudioSettings) {
    const prev = this.audioSettings;
    this.audioSettings = { ...newSettings };

    if (this.micGainNode && this.audioContext) {
      const targetGain = this.isMuted ? 0 : newSettings.inputVolume / 100;
      this.micGainNode.gain.setTargetAtTime(targetGain, this.audioContext.currentTime, 0.02);
    }

    const needHardwareRestart =
      prev.inputDeviceId !== newSettings.inputDeviceId ||
      prev.inputProfile !== newSettings.inputProfile ||
      prev.echoCancellation !== newSettings.echoCancellation ||
      prev.noiseSuppression !== newSettings.noiseSuppression ||
      prev.autoGainControl !== newSettings.autoGainControl;

    if (needHardwareRestart && this.rawMicStream) {
      try {
        const oldRaw = this.rawMicStream;
        this.rawMicStream = await navigator.mediaDevices.getUserMedia({
          audio: this.buildAudioConstraints(),
          video: false,
        });
        oldRaw.getTracks().forEach((t) => t.stop());
        this.setupMicProcessingPipeline(this.rawMicStream);

        const newProcessedTrack = this.localStream?.getAudioTracks()[0];
        if (newProcessedTrack) {
          for (const pc of this.peerConnections.values()) {
            const sender = pc
              .getSenders()
              .find((s) => s.track && s.track.kind === 'audio' && s.track !== this.screenStream?.getAudioTracks()[0]);
            if (sender) {
              await sender.replaceTrack(newProcessedTrack);
            }
          }
        }
      } catch (err) {
        console.warn('[WebRTC] Erro ao trocar dispositivo de microfone:', err);
      }
    }
  }

  public setMicrophoneMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    if (this.rawMicStream) {
      this.rawMicStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    if (this.micGainNode && this.audioContext) {
      this.micGainNode.gain.setTargetAtTime(
        muted ? 0 : this.audioSettings.inputVolume / 100,
        this.audioContext.currentTime,
        0.015
      );
    }
    if (muted) {
      this.onSpeakingChange?.(false);
    }
  }

  /**
   * Filtra o áudio do compartilhamento de tela para NUNCA transmitir a voz/sons do próprio Janjacord (Zero Eco!)
   */
  private buildEchoFreeScreenStream(rawStream: MediaStream): MediaStream {
    const videoTracks = rawStream.getVideoTracks();
    const audioTracks = rawStream.getAudioTracks();

    if (audioTracks.length === 0) {
      return rawStream;
    }

    const rawAudioTrack = audioTracks[0];
    const settings = (rawAudioTrack.getSettings ? rawAudioTrack.getSettings() : {}) as any;
    const hasNativeOwnAudioExclusion = settings.restrictOwnAudio === true;

    try {
      const ctx = this.getAudioContext();
      const source = ctx.createMediaStreamSource(new MediaStream([rawAudioTrack]));
      const gainNode = ctx.createGain();
      gainNode.gain.value = 1.0;
      const destination = ctx.createMediaStreamDestination();

      source.connect(gainNode);
      gainNode.connect(destination);
      this.screenAudioGainNode = gainNode;

      if (this.antiEchoInterval) {
        clearInterval(this.antiEchoInterval);
      }

      const freqData = new Uint8Array(128);
      this.antiEchoInterval = window.setInterval(() => {
        if (!this.screenAudioGainNode || !this.audioContext) return;

        if (hasNativeOwnAudioExclusion) {
          return;
        }

        let remoteSpeakingNow = false;
        for (const { analyser } of this.remoteVoiceAnalysers.values()) {
          analyser.getByteFrequencyData(freqData);
          let sum = 0;
          for (let i = 0; i < freqData.length; i++) sum += freqData[i];
          const avg = sum / freqData.length;
          if (avg > 10) {
            remoteSpeakingNow = true;
            break;
          }
        }

        const targetGain = remoteSpeakingNow ? 0.0 : 1.0;
        const timeConstant = remoteSpeakingNow ? 0.01 : 0.08;
        this.screenAudioGainNode.gain.setTargetAtTime(
          targetGain,
          this.audioContext.currentTime,
          timeConstant
        );
      }, 35);

      const processedAudioTrack = destination.stream.getAudioTracks()[0];
      if (processedAudioTrack) {
        return new MediaStream([...videoTracks, processedAudioTrack]);
      }
    } catch (err) {
      console.warn('[WebRTC] Aviso ao criar filtro anti-eco WebAudio:', err);
    }

    return rawStream;
  }

  /**
   * Inicia o compartilhamento de tela (compatível com Navegador Web e App Desktop Electron)
   */
  public async startScreenShare(
    presetKey: StreamQualityPreset,
    sourceId?: string,
    shareAudio: boolean = true
  ): Promise<MediaStream> {
    const preset = QUALITY_PRESETS[presetKey];

    if (this.screenStream) {
      this.stopScreenShare();
    }

    let acquiredStream: MediaStream | null = null;

    const antiEchoAudioConstraints: any = shareAudio
      ? {
          restrictOwnAudio: true,
          disableLocalEcho: true,
          suppressLocalAudioPlayback: false,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      : false;

    if (window.electronAPI?.isElectron) {
      if (sourceId) {
        await window.electronAPI.selectDesktopSource({ sourceId, shareAudio });
      }

      try {
        acquiredStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: antiEchoAudioConstraints,
          systemAudio: 'include',
          selfBrowserSurface: 'exclude',
        } as any);
      } catch (err1) {
        console.warn('[WebRTC Electron] Tentativa 1 falhou, tentando vídeo + áudio simples:', err1);
        try {
          acquiredStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: shareAudio,
          });
        } catch (err2) {
          console.warn('[WebRTC Electron] Tentativa 2 falhou, tentando somente vídeo:', err2);
          try {
            await window.electronAPI.selectDesktopSource({ sourceId: sourceId || '', shareAudio: false });
            acquiredStream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: false,
            });
          } catch (err3) {
            if (sourceId) {
              acquiredStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                  mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId,
                    maxWidth: preset.width,
                    maxHeight: preset.height,
                    maxFrameRate: preset.fps,
                  },
                } as any,
              });
            } else {
              throw err3;
            }
          }
        }
      }
    } else {
      acquiredStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: preset.width, max: preset.width },
          height: { ideal: preset.height, max: preset.height },
          frameRate: { ideal: preset.fps, max: preset.fps },
        },
        audio: antiEchoAudioConstraints,
        systemAudio: 'include',
        selfBrowserSurface: 'exclude',
      } as any);
    }

    if (!acquiredStream) {
      throw new Error('Não foi possível obter a transmissão de tela.');
    }

    this.rawScreenStream = acquiredStream;
    this.screenStream = this.buildEchoFreeScreenStream(acquiredStream);

    const videoTrack = this.screenStream.getVideoTracks()[0];
    if (videoTrack) {
      if ('contentHint' in videoTrack) {
        videoTrack.contentHint = 'motion';
      }

      try {
        await videoTrack.applyConstraints({
          width: { ideal: preset.width, max: preset.width },
          height: { ideal: preset.height, max: preset.height },
          frameRate: { ideal: preset.fps, max: preset.fps },
        });
      } catch (constraintErr) {
        console.warn('[WebRTC] Aviso ao aplicar constraints na captura:', constraintErr);
      }

      videoTrack.onended = () => {
        this.stopScreenShare();
        this.onScreenShareEnded?.();
      };
    }

    for (const [peerId, pc] of this.peerConnections.entries()) {
      for (const track of this.screenStream.getTracks()) {
        const sender = pc.addTrack(track, this.screenStream);
        if (track.kind === 'video') {
          await this.applyBitrateLimit(sender, preset.bitrateKbps, preset.fps);
        }
      }
      await this.renegotiate(peerId, pc);
    }

    return this.screenStream;
  }

  public async updateScreenQuality(presetKey: StreamQualityPreset) {
    if (!this.screenStream) return;
    const preset = QUALITY_PRESETS[presetKey];

    const videoTrack = this.screenStream.getVideoTracks()[0];
    if (videoTrack) {
      try {
        await videoTrack.applyConstraints({
          width: { ideal: preset.width, max: preset.width },
          height: { ideal: preset.height, max: preset.height },
          frameRate: { ideal: preset.fps, max: preset.fps },
        });
      } catch (e) {
        console.warn('[WebRTC] Aviso ao atualizar qualidade:', e);
      }
    }

    for (const pc of this.peerConnections.values()) {
      const senders = pc.getSenders();
      for (const sender of senders) {
        if (sender.track && sender.track.kind === 'video') {
          await this.applyBitrateLimit(sender, preset.bitrateKbps, preset.fps);
        }
      }
    }
  }

  private async applyBitrateLimit(sender: RTCRtpSender, maxBitrateKbps: number, maxFps: number) {
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      params.encodings[0].maxBitrate = maxBitrateKbps * 1000;
      params.encodings[0].maxFramerate = maxFps;
      params.degradationPreference = 'maintain-framerate';
      await sender.setParameters(params);
    } catch (e) {
      console.warn('Aviso ao configurar bitrate WebRTC:', e);
    }
  }

  public stopScreenShare() {
    if (this.antiEchoInterval) {
      clearInterval(this.antiEchoInterval);
      this.antiEchoInterval = null;
    }
    this.screenAudioGainNode = null;

    if (!this.screenStream && !this.rawScreenStream) return;

    const screenTracks = new Set([
      ...(this.screenStream ? this.screenStream.getTracks() : []),
      ...(this.rawScreenStream ? this.rawScreenStream.getTracks() : []),
    ]);

    screenTracks.forEach((track) => {
      track.onended = null;
      track.stop();
    });

    for (const [peerId, pc] of this.peerConnections.entries()) {
      const senders = pc.getSenders();
      senders.forEach((sender) => {
        if (sender.track && (screenTracks.has(sender.track) || sender.track.kind === 'video')) {
          try {
            pc.removeTrack(sender);
          } catch {}
        }
      });
      this.renegotiate(peerId, pc);
    }

    this.screenStream = null;
    this.rawScreenStream = null;
  }

  private async renegotiate(peerId: string, pc?: RTCPeerConnection) {
    const conn = pc || this.peerConnections.get(peerId);
    if (!conn) return;

    try {
      this.makingOffer.set(peerId, true);
      const offer = await conn.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      if (conn.signalingState !== 'stable') return;
      await conn.setLocalDescription(offer);
      this.socket.emit('webrtc:offer', {
        targetSocketId: peerId,
        toPeerId: peerId,
        offer: conn.localDescription || offer,
      });
    } catch (e) {
      console.error('Erro na renegociação WebRTC:', e);
    } finally {
      this.makingOffer.set(peerId, false);
    }
  }

  private closePeerConnection(peerId: string) {
    const analyserEntry = this.remoteVoiceAnalysers.get(peerId);
    if (analyserEntry) {
      try {
        analyserEntry.source.disconnect();
      } catch {}
      this.remoteVoiceAnalysers.delete(peerId);
    }

    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    this.makingOffer.delete(peerId);
    this.ignoreOffer.delete(peerId);
    this.pendingCandidates.delete(peerId);
  }

  public leaveAll() {
    if (this.speakingInterval) {
      clearInterval(this.speakingInterval);
      this.speakingInterval = null;
    }
    if (this.antiEchoInterval) {
      clearInterval(this.antiEchoInterval);
      this.antiEchoInterval = null;
    }
    this.remoteVoiceAnalysers.clear();
    this.screenAudioGainNode = null;
    this.onRemoteSpeakingChange?.([]);

    if (this.rawScreenStream) {
      this.rawScreenStream.getTracks().forEach((t) => t.stop());
      this.rawScreenStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }
    if (this.rawMicStream) {
      this.rawMicStream.getTracks().forEach((t) => t.stop());
      this.rawMicStream = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.micSourceNode = null;
    this.micGainNode = null;
    this.micDestinationNode = null;
    this.analyser = null;

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    for (const peerId of this.peerConnections.keys()) {
      this.closePeerConnection(peerId);
    }
  }
}
