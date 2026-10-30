import { Socket } from 'socket.io-client';
import { QUALITY_PRESETS, type StreamQualityPreset } from '../types';

export class WebRTCManager {
  private socket: Socket;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private makingOffer: Map<string, boolean> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private speakingInterval: number | null = null;

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
      } catch (err) {
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

      if (event.track.kind === 'video') {
        event.track.onended = () => {
          this.onRemoteScreenRemoved?.(peerId);
        };
        event.track.onmute = () => {
          // Alguns navegadores emitem mute ao remover a track na renegociação
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
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      let lastState = false;

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
   * Inicia o compartilhamento de tela (compatível tanto com Navegador Web quanto com App Desktop Electron)
   */
  public async startScreenShare(
    presetKey: StreamQualityPreset,
    sourceId?: string,
    shareAudio: boolean = true
  ): Promise<MediaStream> {
    const preset = QUALITY_PRESETS[presetKey];

    // Se já houver uma transmissão ativa, encerra antes de iniciar a nova
    if (this.screenStream) {
      this.stopScreenShare();
    }

    let acquiredStream: MediaStream | null = null;

    if (window.electronAPI?.isElectron) {
      // 1. Informa ao processo principal do Electron qual tela/janela o usuário selecionou
      if (sourceId) {
        await window.electronAPI.selectDesktopSource({ sourceId, shareAudio });
      }

      // 2. Tenta capturar via getDisplayMedia (interceptado por setDisplayMediaRequestHandler no main.cjs)
      try {
        acquiredStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: shareAudio,
        });
      } catch (err1) {
        console.warn('[WebRTC Electron] Tentativa 1 (vídeo + áudio loopback) falhou, tentando somente vídeo:', err1);
        try {
          await window.electronAPI.selectDesktopSource({ sourceId: sourceId || '', shareAudio: false });
          acquiredStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
          });
        } catch (err2) {
          console.warn('[WebRTC Electron] Tentativa 2 falhou, usando chromeMediaSource desktop:', err2);
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
            throw err2;
          }
        }
      }
    } else {
      // Fluxo padrão do Navegador Web
      acquiredStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: preset.width, max: preset.width },
          height: { ideal: preset.height, max: preset.height },
          frameRate: { ideal: preset.fps, max: preset.fps },
        },
        audio: shareAudio
          ? {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            }
          : false,
      });
    }

    if (!acquiredStream) {
      throw new Error('Não foi possível obter a transmissão de tela.');
    }

    this.screenStream = acquiredStream;

    const videoTrack = this.screenStream.getVideoTracks()[0];
    if (videoTrack) {
      if ('contentHint' in videoTrack) {
        videoTrack.contentHint = 'motion';
      }

      // Aplica limites de resolução e FPS de forma segura sem derrubar a stream
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

    // Anexa as tracks de vídeo (e áudio do sistema, se presente) a todos os peers conectados
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
    if (!this.screenStream) return;

    const screenTracks = new Set(this.screenStream.getTracks());
    this.screenStream.getTracks().forEach((track) => {
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
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    for (const peerId of this.peerConnections.keys()) {
      this.closePeerConnection(peerId);
    }
  }
}
