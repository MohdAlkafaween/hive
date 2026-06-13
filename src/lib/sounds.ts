/**
 * Shared AudioContext singleton for notification sounds.
 * Browsers require user gesture to start AudioContext — we bootstrap
 * via a one-time click/touchstart listener that calls ctx.resume().
 */

type WinWithWebkit = Window & { webkitAudioContext?: typeof AudioContext }

let ctx: AudioContext | null = null
let bootstrapped = false

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AudioCtx = window.AudioContext || (window as WinWithWebkit).webkitAudioContext
    if (!AudioCtx) return null
    ctx = new AudioCtx()
  }
  return ctx
}

/**
 * Call once per page to ensure AudioContext gets resumed on the first user gesture.
 * Safe to call multiple times — only the first call attaches listeners.
 */
export function bootstrapAudio() {
  if (bootstrapped || typeof window === 'undefined') return
  bootstrapped = true

  const resume = () => {
    const c = getCtx()
    if (c && c.state === 'suspended') c.resume().catch(() => {})
  }

  window.addEventListener('click', resume, { once: false, passive: true })
  window.addEventListener('touchstart', resume, { once: false, passive: true })
}

/**
 * Staff-side: loud triple-beep alert for new pending order.
 * Uses square wave at 1kHz for a sharp, attention-grabbing tone
 * that cuts through cafe ambient noise.
 */
export async function playNotificationBeep() {
  const c = getCtx()
  if (!c) return
  try {
    if (c.state === 'suspended') await c.resume()
    const now = c.currentTime

    // Three-beep alert pattern: BEEP-BEEP-BEEP
    for (let i = 0; i < 3; i++) {
      const startTime = now + i * 0.3 // 300ms apart
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.connect(gain)
      gain.connect(c.destination)
      osc.frequency.value = 1000  // 1kHz — sharp, cuts through noise
      osc.type = 'square'         // harsher than sine — more noticeable
      gain.gain.setValueAtTime(0.5, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15)
      osc.start(startTime)
      osc.stop(startTime + 0.15)
    }
  } catch {}
}

/**
 * Customer-side: two-tone chime for order-ready.
 */
export async function playOrderReadyChime() {
  const c = getCtx()
  if (!c) return
  try {
    if (c.state === 'suspended') await c.resume()
    const playTone = (freq: number, start: number, dur: number) => {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.connect(gain)
      gain.connect(c.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.25, c.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur)
      osc.start(c.currentTime + start)
      osc.stop(c.currentTime + start + dur)
    }
    playTone(660, 0, 0.25)
    playTone(880, 0.2, 0.35)
  } catch {}
}
