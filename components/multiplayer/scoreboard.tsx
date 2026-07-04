'use client'

import { useEffect, useState } from 'react'
import { useMultiplayerStore } from '@/lib/multiplayer/mp-store'

export function Scoreboard() {
  const scoreboard = useMultiplayerStore((s) => s.scoreboard)
  const matchEndsAt = useMultiplayerStore((s) => s.matchEndsAt)
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    if (!matchEndsAt) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [matchEndsAt])

  const remainingS =
    matchEndsAt && now !== null ? Math.max(0, Math.ceil((matchEndsAt - now) / 1000)) : null
  const mm = remainingS !== null ? Math.floor(remainingS / 60) : 0
  const ss = remainingS !== null ? remainingS % 60 : 0

  return (
    <div className="absolute right-5 top-5 z-10 flex w-56 flex-col gap-1 font-mono text-white">
      {remainingS !== null && (
        <div className="mb-1 self-end text-xs tracking-[0.3em] text-white/60 tabular-nums">
          {mm}:{ss.toString().padStart(2, '0')}
        </div>
      )}
      {scoreboard.slice(0, 8).map((entry, i) => (
        <div
          key={entry.playerId}
          className={`flex items-center justify-between border px-2 py-1 text-[11px] tracking-widest ${
            entry.isLocal ? 'border-white bg-white/10' : 'border-white/15 bg-black/40'
          }`}
        >
          <span className="truncate">
            {i + 1}. {entry.name}
          </span>
          <span className="tabular-nums text-white/60">
            {entry.kills}/{entry.deaths}
          </span>
        </div>
      ))}
    </div>
  )
}
