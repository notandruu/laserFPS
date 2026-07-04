'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useMultiplayerStore } from '@/lib/multiplayer/mp-store'
import { disconnectRoom } from '@/lib/multiplayer/net-sync'
import { buildScoreboard, tickMatchClock } from '@/lib/multiplayer/match-logic'
import { MultiplayerHud } from './multiplayer-hud'

const MultiplayerScene = dynamic(
  () => import('./mp-scene').then((m) => m.MultiplayerScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-black font-mono text-xs tracking-[0.4em] text-white/50">
        CONNECTING...
      </div>
    ),
  }
)

export function MultiplayerGame({ onExit }: { onExit: () => void }) {
  const matchPhase = useMultiplayerStore((s) => s.matchPhase)
  const setScoreboard = useMultiplayerStore((s) => s.setScoreboard)

  // Runs independent of the R3F frame loop so it keeps ticking through the lobby.
  useEffect(() => {
    const id = setInterval(() => {
      tickMatchClock()
      setScoreboard(buildScoreboard())
    }, 400)
    return () => clearInterval(id)
  }, [setScoreboard])

  useEffect(() => {
    return () => {
      disconnectRoom()
    }
  }, [])

  const showScene = matchPhase !== 'room'

  return (
    <div className="relative h-dvh w-full cursor-none overflow-hidden bg-black">
      {showScene && <MultiplayerScene />}
      <MultiplayerHud onExit={onExit} />
    </div>
  )
}
