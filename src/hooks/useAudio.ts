'use client'
import { useCallback, useRef } from 'react'

export function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null)

  const getCtx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    return ctxRef.current
  }, [])

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine') => {
    try {
      const ctx = getCtx()
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = type
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch {}
  }, [getCtx])

  const playSuccess = useCallback(() => {
    playTone(880, 0.12)
    setTimeout(() => playTone(1100, 0.2), 100)
  }, [playTone])

  const playError = useCallback(() => {
    playTone(300, 0.15, 'sawtooth')
    setTimeout(() => playTone(220, 0.3, 'sawtooth'), 120)
  }, [playTone])

  return { playSuccess, playError }
}
