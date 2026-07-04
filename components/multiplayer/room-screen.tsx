'use client'

import { useCallback, useState } from 'react'
import { createRoom, findRoom } from '@/lib/multiplayer/rooms'
import { useMultiplayerStore } from '@/lib/multiplayer/mp-store'
import { connectRoom } from '@/lib/multiplayer/net-sync'
import { handleHit, handleKill, handleMatchState } from '@/lib/multiplayer/match-logic'

export function RoomScreen({ onExit }: { onExit: () => void }) {
  const myPlayerId = useMultiplayerStore((s) => s.myPlayerId)
  const myName = useMultiplayerStore((s) => s.myName)
  const myClass = useMultiplayerStore((s) => s.myClass)
  const setMyName = useMultiplayerStore((s) => s.setMyName)
  const setRoomCode = useMultiplayerStore((s) => s.setRoomCode)
  const setIsHost = useMultiplayerStore((s) => s.setIsHost)
  const setMatchPhase = useMultiplayerStore((s) => s.setMatchPhase)
  const roomError = useMultiplayerStore((s) => s.roomError)
  const setRoomError = useMultiplayerStore((s) => s.setRoomError)

  const [joinCode, setJoinCode] = useState(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? ''
  })
  const [busy, setBusy] = useState(false)

  const joinChannel = useCallback(
    async (code: string, isHost: boolean) => {
      await connectRoom(
        code,
        { playerId: myPlayerId, name: myName, classId: myClass, ready: false, isHost },
        { onHit: handleHit, onKill: handleKill, onMatchState: handleMatchState }
      )
      setRoomCode(code)
      setIsHost(isHost)
      setMatchPhase('lobby')
      const url = new URL(window.location.href)
      url.searchParams.set('room', code)
      window.history.replaceState({}, '', url)
    },
    [myPlayerId, myName, myClass, setRoomCode, setIsHost, setMatchPhase]
  )

  const onCreate = useCallback(async () => {
    setBusy(true)
    setRoomError(null)
    try {
      const room = await createRoom(myPlayerId)
      await joinChannel(room.id, true)
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'Failed to create room')
    } finally {
      setBusy(false)
    }
  }, [myPlayerId, joinChannel, setRoomError])

  const onJoin = useCallback(async () => {
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setBusy(true)
    setRoomError(null)
    try {
      const room = await findRoom(code)
      if (!room) {
        setRoomError('No room with that code')
        return
      }
      await joinChannel(room.id, false)
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'Failed to join room')
    } finally {
      setBusy(false)
    }
  }, [joinCode, joinChannel, setRoomError])

  return (
    <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-8 bg-black/85 p-6 font-mono text-white backdrop-blur-sm">
      <h1 className="text-3xl font-bold tracking-[0.35em]">MULTIPLAYER</h1>

      <div className="flex w-72 flex-col gap-2">
        <label className="text-[10px] tracking-[0.3em] text-white/50">CALLSIGN</label>
        <input
          value={myName}
          onChange={(e) => setMyName(e.target.value.slice(0, 16).toUpperCase())}
          className="border border-white/25 bg-black/60 px-3 py-2 text-sm tracking-widest text-white outline-none focus:border-white"
        />
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={onCreate}
        className="w-72 border border-white bg-white px-6 py-3 text-sm font-bold tracking-[0.3em] text-black transition-colors hover:bg-black hover:text-white disabled:opacity-40"
      >
        CREATE ROOM
      </button>

      <div className="flex w-72 items-center gap-2 text-[10px] tracking-[0.3em] text-white/40">
        <div className="h-px flex-1 bg-white/20" />
        OR
        <div className="h-px flex-1 bg-white/20" />
      </div>

      <div className="flex w-72 gap-2">
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.slice(0, 6).toUpperCase())}
          placeholder="ROOM CODE"
          className="w-full border border-white/25 bg-black/60 px-3 py-2 text-center text-sm tracking-[0.3em] text-white outline-none placeholder:text-white/30 focus:border-white"
        />
        <button
          type="button"
          disabled={busy || !joinCode.trim()}
          onClick={onJoin}
          className="shrink-0 border border-white/60 px-4 py-2 text-sm font-bold tracking-widest transition-colors hover:border-white hover:bg-white hover:text-black disabled:opacity-40"
        >
          JOIN
        </button>
      </div>

      {roomError && <div className="text-xs tracking-widest text-red-400">{roomError}</div>}

      <button
        type="button"
        onClick={onExit}
        className="mt-4 text-[11px] tracking-[0.3em] text-white/40 hover:text-white"
      >
        BACK
      </button>
    </div>
  )
}
