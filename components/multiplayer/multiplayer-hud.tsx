'use client'

import { useEffect, useRef, useState } from 'react'
import { CLASSES } from '@/lib/multiplayer/classes'
import { useMultiplayerStore } from '@/lib/multiplayer/mp-store'
import { disconnectRoom } from '@/lib/multiplayer/net-sync'
import { RoomScreen } from './room-screen'
import { LobbyScreen } from './lobby-screen'
import { Scoreboard } from './scoreboard'
import { MatchEndScreen } from './match-end-screen'

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

export function MultiplayerHud({ onExit }: { onExit: () => void }) {
  const matchPhase = useMultiplayerStore((s) => s.matchPhase)
  const myClass = useMultiplayerStore((s) => s.myClass)
  const health = useMultiplayerStore((s) => s.health)
  const maxHealth = useMultiplayerStore((s) => s.maxHealth)
  const alive = useMultiplayerStore((s) => s.alive)
  const weaponCooldown = useMultiplayerStore((s) => s.weaponCooldown)
  const abilityCooldown = useMultiplayerStore((s) => s.abilityCooldown)
  const matchEndsAt = useMultiplayerStore((s) => s.matchEndsAt)
  const damageTick = useMultiplayerStore((s) => s.damageTick)
  const setMatchPhase = useMultiplayerStore((s) => s.setMatchPhase)

  const inMatch = matchPhase === 'active'
  const [flash, setFlash] = useState(false)
  const [locked, setLocked] = useState(false)
  const [countdownS, setCountdownS] = useState(0)

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

  const firstTick = useRef(damageTick)
  useEffect(() => {
    if (damageTick === firstTick.current) return
    setFlash(true)
    const id = setTimeout(() => setFlash(false), 220)
    return () => clearTimeout(id)
  }, [damageTick])

  useEffect(() => {
    if (matchPhase !== 'countdown' || !matchEndsAt) return
    const id = setInterval(() => {
      setCountdownS(Math.max(0, Math.ceil((matchEndsAt - Date.now()) / 1000)))
    }, 100)
    return () => clearInterval(id)
  }, [matchPhase, matchEndsAt])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return
      if (matchPhase === 'active' || matchPhase === 'countdown') {
        disconnectRoom()
        setMatchPhase('room')
        onExit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [matchPhase, onExit, setMatchPhase])

  const healthPct = Math.round((health / maxHealth) * 100)
  const weaponReady = weaponCooldown <= 0
  const abilityReady = abilityCooldown <= 0
  const cls = CLASSES[myClass]

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none font-mono text-white">
      {matchPhase === 'room' && <RoomScreen onExit={onExit} />}
      {matchPhase === 'lobby' && <LobbyScreen onLeave={onExit} />}

      {matchPhase === 'countdown' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
          <span className="text-8xl font-bold tabular-nums">{countdownS}</span>
        </div>
      )}

      {inMatch && <Crosshair />}
      {inMatch && <Scoreboard />}

      {inMatch && !locked && alive && (
        <div className="absolute left-1/2 top-[58%] z-20 -translate-x-1/2 animate-pulse text-center text-[11px] tracking-[0.4em] text-white/70">
          CLICK TO LOOK AROUND
        </div>
      )}

      {!alive && matchPhase === 'active' && (
        <div className="absolute left-1/2 top-[45%] z-20 -translate-x-1/2 text-center text-sm tracking-[0.4em] text-white/70">
          ELIMINATED — RESPAWNING
        </div>
      )}

      {flash && (
        <div className="absolute inset-0 z-30 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(255,255,255,0.28)_100%)]" />
      )}

      {inMatch && (
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
          <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 items-center gap-2 text-[10px] tracking-[0.24em]">
            <span className="border border-white bg-white px-3 py-1.5 text-black">
              {cls.weaponName} {weaponReady ? 'READY' : weaponCooldown.toFixed(1)}
            </span>
            <span className="border border-white/25 bg-black/40 px-3 py-1.5 text-white/55">
              {cls.abilityName} {abilityReady ? 'READY' : abilityCooldown.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] tracking-widest text-white/35">
            <span>WASD MOVE</span>
            <span>SPACE {cls.abilityName}</span>
            <span>CLICK {cls.weaponName}</span>
            <span>ESC LEAVE</span>
          </div>
        </div>
      )}

      {matchPhase === 'ended' && <MatchEndScreen onLeave={onExit} />}
    </div>
  )
}
