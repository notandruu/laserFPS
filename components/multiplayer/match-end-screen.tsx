'use client'

import { useCallback, useState } from 'react'
import { useMultiplayerStore } from '@/lib/multiplayer/mp-store'
import { startCountdown } from '@/lib/multiplayer/match-logic'
import { setRoomStatus } from '@/lib/multiplayer/rooms'
import { disconnectRoom } from '@/lib/multiplayer/net-sync'

export function MatchEndScreen({ onLeave }: { onLeave: () => void }) {
  const winnerId = useMultiplayerStore((s) => s.winnerId)
  const myPlayerId = useMultiplayerStore((s) => s.myPlayerId)
  const myName = useMultiplayerStore((s) => s.myName)
  const isHost = useMultiplayerStore((s) => s.isHost)
  const roomCode = useMultiplayerStore((s) => s.roomCode)
  const scoreboard = useMultiplayerStore((s) => s.scoreboard)
  const setMatchPhase = useMultiplayerStore((s) => s.setMatchPhase)
  const [restarting, setRestarting] = useState(false)

  const won = winnerId === myPlayerId
  const winnerEntry = scoreboard.find((e) => e.playerId === winnerId)
  const winnerName = winnerEntry?.name ?? (won ? myName : 'UNKNOWN')

  const rematch = useCallback(async () => {
    if (!roomCode) return
    setRestarting(true)
    try {
      await setRoomStatus(roomCode, 'in_progress')
      startCountdown()
    } finally {
      setRestarting(false)
    }
  }, [roomCode])

  const leave = useCallback(() => {
    disconnectRoom()
    setMatchPhase('room')
    onLeave()
  }, [onLeave, setMatchPhase])

  return (
    <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-8 bg-black/85 font-mono text-white backdrop-blur-sm">
      <span className="text-xs tracking-[0.4em] text-white/50">MATCH OVER</span>
      <div className="flex flex-col items-center gap-1">
        <span className="text-5xl font-bold tracking-tight">{winnerName}</span>
        <span className="text-sm tracking-[0.3em] text-white/60">
          {won ? 'YOU WIN' : 'WINS'}
        </span>
      </div>

      <div className="flex w-72 flex-col gap-1">
        {scoreboard.slice(0, 8).map((entry, i) => (
          <div
            key={entry.playerId}
            className={`flex items-center justify-between border px-3 py-1.5 text-xs tracking-widest ${
              entry.isLocal ? 'border-white bg-white/10' : 'border-white/15 bg-black/30'
            }`}
          >
            <span>
              {i + 1}. {entry.name}
            </span>
            <span className="tabular-nums text-white/60">
              {entry.kills}K / {entry.deaths}D
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        {isHost && (
          <button
            type="button"
            disabled={restarting}
            onClick={rematch}
            className="border border-white bg-white px-8 py-3 text-sm font-bold tracking-[0.3em] text-black transition-colors hover:bg-black hover:text-white disabled:opacity-40"
          >
            REMATCH
          </button>
        )}
        <button
          type="button"
          onClick={leave}
          className="border border-white/40 px-8 py-3 text-sm font-bold tracking-[0.3em] transition-colors hover:border-white hover:bg-white hover:text-black"
        >
          LEAVE
        </button>
      </div>
    </div>
  )
}
