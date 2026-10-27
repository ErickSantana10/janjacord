import { Socket } from 'socket.io-client';
import { QUALITY_PRESETS } from '../types';
import type { StreamQualityPreset } from '../types';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class WebRTCManager {
  private socket: Socket;
  private localAudioStream: MediaStream | null = null;
  private localScreenStream: MediaStream | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private audioAnalyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private checkSpeakingInterval: number | null = null;

  public onRemoteStream?: (peerId: string, stream: MediaStream, isScreen: boolean) => void;
  public onPeerDisconnected?: (peerId: string) => void;
  public onSpeakingChange?: (isSpeaking: boolean) => void;
  public onScreenShareEnded?: () => void;

  constructor(socket: Socket) {
    this.socket = socket;
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    this.socket.on('webrtc:offer', async ({ fromPeerId, offer }) => {
      console.log('[WebRTC] Recebido offer de:', fromPeerId);
      const pc = this.getOrCreatePeerConnection(fromPeerId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socket.emit('webrtc:answer', { toPeerId: fromPeerId, answer });
    });

    this.socket.on('webrtc:answer', async ({ fromPeerId, answer }) => {
      console.log('[WebRTC] Recebido answer de:', fromPeerId);
      const pc = this.peerConnections.get(fromPeerId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    this.socket.on('webrtc:ice-candidate', async ({ fromPeerId, candidate }) => {
      const pc = this.peerConnections.get(fromPeerId);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('[WebRTC] Erro ao adicionar ICE candidate:', err);
        }
      }
    });

    this.socket.on('voice:peer-left', ({ peerId }: { peerId: string }) => {
      this.closePeerConnection(peerId);
      if (this.onPeerDisconnected) {
        this.onPeerDisconnected(peerId);
      }
    });
  }

  public async startMicrophone(): Promise<MediaStream> {
    if (this.localAudioStream) return this.localAudioStream;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.localAudioStream = stream;
      this.setupSpeakingDetection(stream);

      // Add audio track to any existing peer connections
      const audioTrack = stream.getAudioTracks()[0];
      this.peerConnections.forEach((pc) => {
        pc.addTrack(audioTrack, stream);
      });

      return stream;
    } catch (err) {
      console.error('[WebRTC] Falha ao acessar microfone:', err);
      throw err;
    }
  }

  public setMicrophoneMuted(muted: boolean) {
    if (this.localAudioStream) {
      this.localAudioStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  private setupSpeakingDetection(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.audioAnalyser = this.audioContext.createAnalyser();
      this.audioAnalyser.fftSize = 256;
      source.connect(this.audioAnalyser);

      const buffer = new Uint8Array(this.audioAnalyser.frequencyBinCount);
      let wasSpeaking = false;

      this.checkSpeakingInterval = window.setInterval(() => {
        if (!this.audioAnalyser || !this.localAudioStream?.getAudioTracks()[0]?.enabled) {
          if (wasSpeaking) {
            wasSpeaking = false;
            this.onSpeakingChange?.(false);
          }
          return;
        }

        this.audioAnalyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const average = sum / buffer.length;
        const isSpeaking = average > 25; // Sensibilidade de fala

        if (isSpeaking !== wasSpeaking) {
          wasSpeaking = isSpeaking;
          this.onSpeakingChange?.(isSpeaking);
        }
      }, 100);
    } catch (e) {
      console.warn('[WebRTC] Falha ao inicializar detecção de fala:', e);
    }
  }

  public async startScreenShare(presetKey: StreamQualityPreset): Promise<MediaStream> {
    const preset = QUALITY_PRESETS[presetKey];

    try {
      // Captura a tela com áudio limpo do sistema/aba
      // Sem forçar restrições de echoCancellation que bloqueiam o som em navegadores como Chrome/Edge
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: preset.width, max: preset.width },
          height: { ideal: preset.height, max: preset.height },
          frameRate: { ideal: preset.fps, max: preset.fps },
        },
        audio: true,
      });

      this.localScreenStream = stream;

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      if (audioTrack) {
        console.log('[WebRTC] Áudio da tela detectado e ativado:', audioTrack.label);
      } else {
        console.warn('[WebRTC] O usuário não marcou a opção "Compartilhar áudio" no modal do navegador.');
      }

      // Auto stop handling when user clicks "Stop sharing" on browser native bar
      videoTrack.onended = () => {
        this.stopScreenShare();
      };

      // Add tracks to all peer connections and apply bitrate limit
      this.peerConnections.forEach((pc) => {
        const videoSender = pc.addTrack(videoTrack, stream);
        this.applyBitrateConstraint(videoSender, preset.bitrateKbps);

        if (audioTrack) {
          pc.addTrack(audioTrack, stream);
        }
        this.renegotiate(pc);
      });

      return stream;
    } catch (err) {
      console.error('[WebRTC] Falha ao iniciar compartilhamento:', err);
      throw err;
    }
  }

  public async updateScreenQuality(presetKey: StreamQualityPreset) {
    if (!this.localScreenStream) return;
    const preset = QUALITY_PRESETS[presetKey];

    const videoTrack = this.localScreenStream.getVideoTracks()[0];
    if (videoTrack) {
      try {
        await videoTrack.applyConstraints({
          width: { ideal: preset.width, max: preset.width },
          height: { ideal: preset.height, max: preset.height },
          frameRate: { ideal: preset.fps, max: preset.fps },
        });
      } catch (err) {
        console.warn('[WebRTC] Constraints não suportadas pelo navegador:', err);
      }
    }

    // Update bitrate on senders
    this.peerConnections.forEach((pc) => {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track?.kind === 'video');
      if (videoSender) {
        this.applyBitrateConstraint(videoSender, preset.bitrateKbps);
      }
    });
  }

  private async applyBitrateConstraint(sender: RTCRtpSender, maxBitrateKbps: number) {
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      params.encodings[0].maxBitrate = maxBitrateKbps * 1000;
      await sender.setParameters(params);
      console.log(`[WebRTC] Bitrate limitado para ${maxBitrateKbps} Kbps`);
    } catch (err) {
      console.warn('[WebRTC] Falha ao limitar bitrate:', err);
    }
  }

  public stopScreenShare() {
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((track) => track.stop());
      this.localScreenStream = null;

      // Remove video tracks from peer connections
      this.peerConnections.forEach((pc) => {
        const senders = pc.getSenders();
        senders.forEach((sender) => {
          if (sender.track?.kind === 'video') {
            pc.removeTrack(sender);
          }
        });
        this.renegotiate(pc);
      });

      this.onScreenShareEnded?.();
    }
  }

  public connectToPeer(peerId: string) {
    const pc = this.getOrCreatePeerConnection(peerId);
    this.initiateOffer(peerId, pc);
  }

  private async initiateOffer(peerId: string, pc: RTCPeerConnection) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.socket.emit('webrtc:offer', { toPeerId: peerId, offer });
  }

  private async renegotiate(pc: RTCPeerConnection) {
    const peerId = this.findPeerIdByConnection(pc);
    if (!peerId) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit('webrtc:offer', { toPeerId: peerId, offer });
    } catch (e) {
      console.error('[WebRTC] Erro na renegociação:', e);
    }
  }

  private findPeerIdByConnection(pc: RTCPeerConnection): string | null {
    for (const [id, conn] of this.peerConnections.entries()) {
      if (conn === pc) return id;
    }
    return null;
  }

  private getOrCreatePeerConnection(peerId: string): RTCPeerConnection {
    let pc = this.peerConnections.get(peerId);
    if (pc) return pc;

    pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnections.set(peerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('webrtc:ice-candidate', {
          toPeerId: peerId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`[WebRTC] Track recebida de ${peerId}: kind=${event.track.kind}, streamId=${event.streams[0]?.id}`);
      
      // Se a track for de vídeo, ou pertencer a uma stream com vídeo (tela compartilhada com áudio)
      const stream = event.streams[0] || new MediaStream([event.track]);
      const hasVideo = stream.getVideoTracks().length > 0 || event.track.kind === 'video';
      
      this.onRemoteStream?.(peerId, stream, hasVideo);
    };

    // Attach local audio if active
    if (this.localAudioStream) {
      this.localAudioStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, this.localAudioStream!);
      });
    }

    // Attach local screen share if active
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localScreenStream!);
      });
    }

    return pc;
  }

  public closePeerConnection(peerId: string) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
  }

  public leaveAll() {
    this.stopScreenShare();

    if (this.localAudioStream) {
      this.localAudioStream.getTracks().forEach((t) => t.stop());
      this.localAudioStream = null;
    }

    if (this.checkSpeakingInterval) {
      clearInterval(this.checkSpeakingInterval);
      this.checkSpeakingInterval = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
  }
}
