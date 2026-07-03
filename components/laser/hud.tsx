'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_HEALTH, useGameStore } from '@/lib/laser/store'

/** Fixed center crosshair */
function Crosshair() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
      <div className="relative size-8">
        <div className="absolute left-1/2 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        <div className="absolute left-1/2 top-0 h-2 w-px -translate-x-1/2 bg-white/70" />
        <div className="absolute bottom-0 left-1/2 h-2 w-px -translate-x-1/2 bg-white/70" />
        <div className="absolute left-0 top-1/2 h-px w-2 -translate-y-1/2 bg-white/70" />
        <div className="absolute right-0 top-1/2 h-px w-2 -translate-y-1/2 bg-white/70" />
        <div className="absolute inset-0 rounded-full border border-white/25" />
      </div>
    </div>
  )
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-white/25 bg-white/5 px-1.5 py-0.5 text-[10px] tracking-widest">
      {children}
    </span>
  )
}

export function Hud() {
  const mode = useGameStore((s) => s.mode)
  const startGame = useGameStore((s) => s.startGame)
  const setMode = useGameStore((s) => s.setMode)
  const health = useGameStore((s) => s.health)
  const score = useGameStore((s) => s.score)
  const wave = useGameStore((s) => s.wave)
  const kills = useGameStore((s) => s.kills)
  const highScore = useGameStore((s) => s.highScore)
  const damageTick = useGameStore((s) => s.damageTick)

  const inGame = mode === 'playing'
  const [flash, setFlash] = useState(false)
  const [locked, setLocked] = useState(false)

  // Track pointer-lock so we can prompt the player to click and look around
  useEffect(() => {
    const onChange = () => setLocked(!!document.pointerLockElement)
    const onReady = () => setLocked(true)
    const onReset = () => setLocked(false)
    document.addEventListener('pointerlockchange', onChange)
    window.addEventListener('laser-look-ready', onReady)
    window.addEventListener('laser-look-reset', onReset)
    return () => {
      document.removeEventListener('pointerlockchange', onChange)
      window.removeEventListener('laser-look-ready', onReady)
      window.removeEventListener('laser-look-reset', onReset)
    }
  }, [])

  // Trigger the red damage vignette whenever the player is hit
  const firstTick = useRef(damageTick)
  useEffect(() => {
    if (damageTick === firstTick.current) return
    setFlash(true)
    const id = setTimeout(() => setFlash(false), 220)
    return () => clearTimeout(id)
  }, [damageTick])

  const start = useCallback(() => {
    startGame()
  }, [startGame])

  // ESC returns to menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && useGameStore.getState().mode !== 'menu') {
        setMode('menu')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setMode])

  const healthPct = Math.round((health / MAX_HEALTH) * 100)

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none font-mono text-white">
      {inGame && <Crosshair />}

      {/* Prompt to engage pointer lock for 360° mouse-look */}
      {inGame && !locked && (
        <div className="absolute left-1/2 top-[58%] z-20 -translate-x-1/2 animate-pulse text-center text-[11px] tracking-[0.4em] text-white/70">
          CLICK TO LOOK AROUND
        </div>
      )}

      {/* Damage flash */}
      {flash && (
        <div className="absolute inset-0 z-30 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(255,255,255,0.28)_100%)]" />
      )}

      {/* ---------- MENU ---------- */}
      {mode === 'menu' && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-10 bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <svg width="56" height="56" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3 L22 20 L2 20 Z" fill="white" />
            </svg>
            <h1 className="text-balance text-center text-4xl font-bold tracking-[0.35em] md:text-6xl">
              LASER STRIKE
            </h1>
            <p className="max-w-md text-pretty text-center text-xs leading-relaxed tracking-widest text-white/50">
              DRONES ADVANCE FROM THE DARK. HOLD THE BEAM. MELT THEM BEFORE THEY REACH YOU.
            </p>
          </div>

          <button
            type="button"
            onClick={start}
            className="w-64 border border-white bg-white px-6 py-3 text-sm font-bold tracking-[0.3em] text-black transition-colors hover:bg-black hover:text-white"
          >
            START
          </button>

          {highScore > 0 && (
            <div className="text-[11px] tracking-[0.3em] text-white/50">
              BEST {highScore}
            </div>
          )}

          <div className="flex items-center gap-4 text-[11px] tracking-widest text-white/40">
            <span className="flex items-center gap-2">
              <Key>MOVE MOUSE</Key> AIM
            </span>
            <span className="flex items-center gap-2">
              <Key>HOLD CLICK</Key> FIRE
            </span>
            <span className="flex items-center gap-2">
              <Key>ESC</Key> MENU
            </span>
          </div>
        </div>
      )}

      {/* ---------- IN-GAME TOP BAR ---------- */}
      {inGame && (
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-5">
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3 L22 20 L2 20 Z" fill="white" />
            </svg>
            <span className="text-xs font-bold tracking-[0.3em]">LASER STRIKE</span>
          </div>

          <div className="flex items-center gap-6 text-xs tracking-[0.3em]">
            <span className="text-white/50">
              WAVE <span className="font-bold text-white">{wave}</span>
            </span>
            <span className="text-white/50">
              KILLS <span className="font-bold text-white tabular-nums">{kills}</span>
            </span>
            <span className="text-white/50">
              SCORE <span className="font-bold text-white tabular-nums">{score}</span>
            </span>
          </div>
        </div>
      )}

      {/* ---------- IN-GAME HEALTH ---------- */}
      {inGame && (
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] tracking-[0.4em] text-white/50">
              INTEGRITY {healthPct}%
            </span>
            <div className="h-1.5 w-56 bg-white/15">
              <div
                className="h-full bg-white transition-[width] duration-200 ease-out"
                style={{ width: `${healthPct}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-4 text-[11px] tracking-widest text-white/35">
            <span className="flex items-center gap-2">
              <Key>HOLD CLICK</Key> FIRE
            </span>
            <span className="flex items-center gap-2">
              <Key>ESC</Key> MENU
            </span>
          </div>
        </div>
      )}

      {/* ---------- GAME OVER ---------- */}
      {mode === 'gameover' && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-8 bg-black/80 backdrop-blur-sm">
          <span className="text-xs tracking-[0.4em] text-white/50">SYSTEMS DOWN</span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-8xl font-bold tabular-nums tracking-tight">
              {score}
            </span>
            <span className="text-sm tracking-[0.3em] text-white/60">FINAL SCORE</span>
          </div>
          <div className="flex gap-8 text-sm tracking-[0.3em] text-white/60">
            <span>
              WAVE <span className="font-bold text-white">{wave}</span>
            </span>
            <span>
              KILLS <span className="font-bold text-white tabular-nums">{kills}</span>
            </span>
            <span>
              BEST <span className="font-bold text-white tabular-nums">{highScore}</span>
            </span>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={start}
              className="border border-white bg-white px-8 py-3 text-sm font-bold tracking-[0.3em] text-black transition-colors hover:bg-black hover:text-white"
            >
              RETRY
            </button>
            <button
              type="button"
              onClick={() => setMode('menu')}
              className="border border-white/40 px-8 py-3 text-sm font-bold tracking-[0.3em] transition-colors hover:border-white hover:bg-white hover:text-black"
            >
              MENU
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
