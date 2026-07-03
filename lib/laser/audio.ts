'use client'

/**
 * Synthesized laser audio via WebAudio, no asset files needed.
 * Continuous filtered hum + noise crackle while firing.
 */
class LaserAudio {
  private ctx: AudioContext | null = null
  private humGain: GainNode | null = null
  private nodes: AudioNode[] = []
  private noiseBuffer: AudioBuffer | null = null

  private ensure() {
    if (this.ctx) return this.ctx
    if (typeof window === 'undefined') return null
    const Ctx = window.AudioContext
    if (!Ctx) return null
    this.ctx = new Ctx()

    // Pre-build a noise buffer for the crackle layer
    const len = this.ctx.sampleRate * 1
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = this.noiseBuffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return this.ctx
  }

  start() {
    const ctx = this.ensure()
    if (!ctx || this.humGain) return
    if (ctx.state === 'suspended') void ctx.resume()

    const master = ctx.createGain()
    master.gain.setValueAtTime(0, ctx.currentTime)
    master.gain.linearRampToValueAtTime(0.11, ctx.currentTime + 0.05)
    master.connect(ctx.destination)

    // Low hum
    const osc1 = ctx.createOscillator()
    osc1.type = 'sawtooth'
    osc1.frequency.value = 68
    const osc2 = ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = 137
    // Slow wobble
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 7
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 4
    lfo.connect(lfoGain)
    lfoGain.connect(osc1.frequency)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 480
    filter.Q.value = 4

    const oscGain = ctx.createGain()
    oscGain.gain.value = 0.55
    osc1.connect(filter)
    osc2.connect(filter)
    filter.connect(oscGain)
    oscGain.connect(master)

    // Crackle
    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuffer
    noise.loop = true
    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 2400
    noiseFilter.Q.value = 1.2
    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0.07
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(master)

    osc1.start()
    osc2.start()
    lfo.start()
    noise.start()

    this.humGain = master
    this.nodes = [osc1, osc2, lfo, noise]
  }

  stop() {
    if (!this.ctx || !this.humGain) return
    const t = this.ctx.currentTime
    this.humGain.gain.cancelScheduledValues(t)
    this.humGain.gain.setValueAtTime(this.humGain.gain.value, t)
    this.humGain.gain.linearRampToValueAtTime(0, t + 0.08)
    const nodes = this.nodes
    const gain = this.humGain
    this.humGain = null
    this.nodes = []
    setTimeout(() => {
      for (const n of nodes) {
        try {
          ;(n as OscillatorNode).stop()
        } catch {
          /* already stopped */
        }
      }
      gain.disconnect()
    }, 140)
  }

  /** Short confirmation blip (used when a stencil is scored) */
  blip(score: number) {
    const ctx = this.ensure()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    const base = score >= 70 ? 660 : 330
    osc.frequency.setValueAtTime(base, t)
    osc.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.12)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.12, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.32)
  }

  /** Harsh descending buzz when the player takes contact damage */
  hurt() {
    const ctx = this.ensure()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(220, t)
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.25)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.16, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.32)
  }
}

export const laserAudio = new LaserAudio()
