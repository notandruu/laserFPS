'use client'

import { useCallback, useState } from 'react'
import { CLASSES, type ClassId } from '@/lib/multiplayer/classes'
import { useMultiplayerStore } from '@/lib/multiplayer/mp-store'
import { updatePresence } from '@/lib/multiplayer/net-sync'
import { startCountdown } from '@/lib/multiplayer/match-logic'
import { setRoomStatus } from '@/lib/multiplayer/rooms'

export function LobbyScreen({ onLeave }: { onLeave: () => void }) {
  const roomCode = useMultiplayerStore((s) => s.roomCode)
  const isHost = useMultiplayerStore((s) => s.isHost)
  const myPlayerId = useMultiplayerStore((s) => s.myPlayerId)
  const myClass = useMultiplayerStore((s) => s.myClass)
  const setMyClass = useMultiplayerStore((s) => s.setMyClass)
  const lobbyPlayers = useMultiplayerStore((s) => s.lobbyPlayers)
  const [starting, setStarting] = useState(false)
  const [copied, setCopied] = useState(false)

  const pickClass = useCallback(
    (classId: ClassId) => {
      setMyClass(classId)
      void updatePresence({ classId })
    },
    [setMyClass]
  )

  const copyLink = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('room', roomCode ?? '')
    void navigator.clipboard.writeText(url.toString())
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [roomCode])

  const start = useCallback(async () => {
    if (!roomCode) return
    setStarting(true)
    try {
      await setRoomStatus(roomCode, 'in_progress')
      startCountdown()
    } finally {
      setStarting(false)
    }
  }, [roomCode])

  return (
    <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-8 bg-black/85 p-6 font-mono text-white backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] tracking-[0.4em] text-white/50">ROOM CODE</span>
        <button
          type="button"
          onClick={copyLink}
          className="text-4xl font-bold tracking-[0.5em] transition-colors hover:text-white/70"
        >
          {roomCode}
        </button>
        <span className="text-[10px] tracking-[0.3em] text-white/40">
          {copied ? 'LINK COPIED' : 'CLICK TO COPY INVITE LINK'}
        </span>
      </div>

      <div className="flex w-80 flex-col gap-2">
        <span className="text-[10px] tracking-[0.3em] text-white/50">CHOOSE CLASS</span>
        <div className="grid grid-cols-2 gap-2">
          {(Object.values(CLASSES)).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pickClass(c.id)}
              className={`flex flex-col gap-1 border px-3 py-2 text-left transition-colors ${
                myClass === c.id
                  ? 'border-white bg-white text-black'
                  : 'border-white/25 bg-black/40 text-white/60 hover:border-white/60'
              }`}
            >
              <span className="text-sm font-bold tracking-widest">{c.name}</span>
              <span className="text-[10px] tracking-widest opacity-70">
                {c.weaponName} / {c.abilityName}
              </span>
            </button>
          ))}
        </div>
        <span className="text-[10px] leading-relaxed tracking-wide text-white/40">
          {CLASSES[myClass].tagline}
        </span>
      </div>

      <div className="flex w-80 flex-col gap-1">
        <span className="text-[10px] tracking-[0.3em] text-white/50">
          PLAYERS ({lobbyPlayers.length})
        </span>
        <div className="flex flex-col gap-1">
          {lobbyPlayers.map((p) => (
            <div
              key={p.playerId}
              className="flex items-center justify-between border border-white/15 bg-white/5 px-3 py-1.5 text-xs tracking-widest"
            >
              <span>
                {p.name} {p.playerId === myPlayerId && '(YOU)'} {p.isHost && '· HOST'}
              </span>
              <span className="text-white/50">{CLASSES[p.classId].name}</span>
            </div>
          ))}
        </div>
      </div>

      {isHost ? (
        <button
          type="button"
          disabled={starting}
          onClick={start}
          className="w-80 border border-white bg-white px-6 py-3 text-sm font-bold tracking-[0.3em] text-black transition-colors hover:bg-black hover:text-white disabled:opacity-40"
        >
          START MATCH
        </button>
      ) : (
        <span className="text-[11px] tracking-[0.3em] text-white/50">
          WAITING FOR HOST TO START
        </span>
      )}

      <button
        type="button"
        onClick={onLeave}
        className="text-[11px] tracking-[0.3em] text-white/40 hover:text-white"
      >
        LEAVE ROOM
      </button>
    </div>
  )
}
