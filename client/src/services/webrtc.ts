import { Socket } from 'socket.io-client';
import { QUALITY_PRESETS, type StreamQualityPreset } from '../types';

export class WebRTCManager {
  private socket: Socket;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private makingOffer: Map<string, boolean> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private rawScreenStream: MediaStream | null = null;

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private speakingInterval: number | null = null;

  // Anti-Eco para compartilhamento de som do sistema: monitora vozes remotas do próprio Janjacord
  private remoteVoiceAnalysers: Map<string, { source: MediaStreamAudioSourceNode; analyser: AnalyserNode }> =
    new Map();
  private screenAudioGainNode: GainNode | null = null;
  private antiEchoInterval: number | null = null;

  public onSpeakingChange?: (isSpeaking: boolean) => void;
  public onRemoteStream?: (peerId: string, stream: MediaStream, isScreen: boolean) => void;
  public onRemoteScreenRemoved?: (peerId: string) => void;
  public onPeerDisconnected?: (peerId: string) => void;
  public onScreenShareEnded?: () => void;

  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  constructor(socket: Socket) {
    this.socket = socket;
    this.setupSignaling();
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

  private setupSignaling() {
    this.socket.on('webrtc:offer', async ({ fromSocketId, offer }) => {
      try {
        const pc = this.getOrCreatePeerConnection(fromSocketId);
        const isPolite = (this.socket.id || '') < fromSocketId;
        const offerCollision = this.makingOffer.get(fromSocketId) || pc.signalingState !== 'stable';

        if (offerCollision) {
          if (!isPolite) {
            return;
          }
          await Promise.all([
            pc.setLocalDescription({ type: 'rollback' }),
            pc.setRemoteDescription(new RTCSessionDescription(offer)),
          ]);
        } else {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.socket.emit('webrtc:answer', {
          targetSocketId: fromSocketId,
          answer,
        });
      } catch (err) {
        console.warn('[WebRTC] Erro ao processar offer:', err);
      }
    });

    this.socket.on('webrtc:answer', async ({ fromSocketId, answer }) => {
      try {
        const pc = this.peerConnections.get(fromSocketId);
        if (pc && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      } catch (err) {
        console.warn('[WebRTC] Erro ao processar answer:', err);
      }
    });

    this.socket.on('webrtc:ice-candidate', async ({ fromSocketId, candidate }) => {
      try {
        const pc = this.peerConnections.get(fromSocketId);
        if (pc && candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch {
        // Ignora candidatos ICE obsoletos durante renegociação
      }
    });

    this.socket.on('voice:peer-left', ({ socketId }) => {
      this.closePeerConnection(socketId);
      this.onPeerDisconnected?.(socketId);
    });
  }

  public async connectToPeer(targetSocketId: string) {
    const pc = this.getOrCreatePeerConnection(targetSocketId);
    await this.renegotiate(targetSocketId, pc);
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
        pc.addTrack(track, this.localStream!);
      });
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.screenStream!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('webrtc:ice-candidate', {
          targetSocketId: peerId,
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
            }, 600);
          }
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

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.closePeerConnection(peerId);
        this.onPeerDisconnected?.(peerId);
      }
    };

    return pc;
  }

  public async startMicrophone(): Promise<MediaStream> {
    if (this.localStream) return this.localStream;

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000,
      },
      video: false,
    });

    this.setupVoiceActivityDetection(this.localStream);

    for (const [peerId, pc] of this.peerConnections.entries()) {
      this.localStream.getTracks().forEach((track) => {
        const alreadyAdded = pc.getSenders().some((s) => s.track === track);
        if (!alreadyAdded) {
          pc.addTrack(track, this.localStream!);
        }
      });
      await this.renegotiate(peerId, pc);
    }

    return this.localStream;
  }

  private setupVoiceActivityDetection(stream: MediaStream) {
    try {
      const ctx = this.getAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      let lastState = false;

      if (this.speakingInterval) clearInterval(this.speakingInterval);
      this.speakingInterval = window.setInterval(() => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const average = sum / dataArray.length;

        const isSpeaking = average > 18;
        if (isSpeaking !== lastState) {
          lastState = isSpeaking;
          this.onSpeakingChange?.(isSpeaking);
        }
      }, 100);
    } catch (e) {
      console.warn('Falha ao iniciar detector de voz:', e);
    }
  }

  public setMicrophoneMuted(muted: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  /**
   * Filtra o áudio do compartilhamento de tela para NUNCA transmitir a voz/sons do próprio Janjacord (Zero Eco!)
   * Combina:
   * 1. Exclusão nativa de processo do Chromium/Windows (`restrictOwnAudio: true` + `disableLocalEcho: true`)
   * 2. Ducking/Gate inteligente em tempo real: se o sistema operacional não suportar `restrictOwnAudio` nativo,
   *    corta instantaneamente o loopback no exato momento em que qualquer amigo na call estiver falando!
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

        // Se o SO já exclui nativamente o processo do Janjacord via WASAPI Process Loopback, mantém ganho 1.0
        if (hasNativeOwnAudioExclusion) {
          return;
        }

        // Caso contrário, verifica se algum participante remoto na call está falando neste exato instante
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

        // Se algum amigo estiver falando no Janjacord, zera o ganho do loopback do PC para a voz dele nunca dar eco!
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

    // Constraints de áudio que instruem o Chromium/Electron a excluir o próprio áudio do Janjacord
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
      const offer = await conn.createOffer();
      if (conn.signalingState !== 'stable') return;
      await conn.setLocalDescription(offer);
      this.socket.emit('webrtc:offer', {
        targetSocketId: peerId,
        offer: conn.localDescription,
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

    if (this.rawScreenStream) {
      this.rawScreenStream.getTracks().forEach((t) => t.stop());
      this.rawScreenStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    for (const peerId of this.peerConnections.keys()) {
      this.closePeerConnection(peerId);
    }
  }
}
