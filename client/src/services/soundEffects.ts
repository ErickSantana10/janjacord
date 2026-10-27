// Web Audio API Sound Synthesizer - 100% nativo, sem necessidade de arquivos externos de áudio

class SoundEffectsManager {
  private audioCtx: AudioContext | null = null;
  private outgoingRingInterval: number | null = null;
  private incomingRingInterval: number | null = null;

  private getContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Som característico agradável de ENTRAR NA CALL (estilo Discord)
  public playJoinVoice() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Dois tons rápidos ascendentes: D5 (587Hz) -> G5 (784Hz)
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.warn('Erro ao tocar som de entrada:', e);
    }
  }

  // Som de SAIR DA CALL (dois tons descendentes suaves)
  public playLeaveVoice() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(783.99, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(523.25, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }

  // Toque de chamada saindo: "Tuuuu... Tuuuu..."
  public startOutgoingRing(): () => void {
    this.stopOutgoingRing();
    const playTone = () => {
      try {
        const ctx = this.getContext();
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.frequency.value = 440;
        osc2.frequency.value = 480;

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.08, ctx.currentTime + 1.2);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 1.4);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(ctx.currentTime);
        osc2.start(ctx.currentTime);

        osc1.stop(ctx.currentTime + 1.5);
        osc2.stop(ctx.currentTime + 1.5);
      } catch (err) {
        console.warn('Erro ao tocar som:', err);
      }
    };

    playTone();
    this.outgoingRingInterval = window.setInterval(playTone, 3000);

    return () => this.stopOutgoingRing();
  }

  public stopOutgoingRing() {
    if (this.outgoingRingInterval) {
      clearInterval(this.outgoingRingInterval);
      this.outgoingRingInterval = null;
    }
  }

  // Toque de chamada recebida
  public startIncomingRingtone(): () => void {
    this.stopIncomingRingtone();
    const playTune = () => {
      try {
        const ctx = this.getContext();
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.value = freq;

          const startTime = ctx.currentTime + idx * 0.14;
          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(0.12, startTime + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + 0.3);
        });
      } catch (err) {
        console.warn('Erro ao tocar som:', err);
      }
    };

    playTune();
    this.incomingRingInterval = window.setInterval(playTune, 2000);

    return () => this.stopIncomingRingtone();
  }

  public stopIncomingRingtone() {
    if (this.incomingRingInterval) {
      clearInterval(this.incomingRingInterval);
      this.incomingRingInterval = null;
    }
  }

  // Som suave ao enviar/receber mensagem
  public playMessagePop() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {}
  }
}

export const sounds = new SoundEffectsManager();
