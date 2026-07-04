'use client'

import type { RealtimeChannel } from '@supabase/supabase-js'
import * as THREE from 'three'
import { supabase } from './supabase-client'
import { getOrCreateRemote, remotePlayers, resetNetState } from './net-state'
import { useMultiplayerStore } from './mp-store'
import type { LobbyPlayer } from './mp-store'
import type {
  BlinkMsg,
  HitMsg,
  KillMsg,
  MatchStateMsg,
  NetMessage,
  PresenceMeta,
  ShotMsg,
  TransformMsg,
} from './messages'

let channel: RealtimeChannel | null = null
let currentMeta: PresenceMeta | null = null

const TRANSFORM_HZ = 18
const TRANSFORM_INTERVAL = 1 / TRANSFORM_HZ
let outSeq = 0
let sendAccum = 0

type Handlers = {
  onHit?: (msg: HitMsg) => void
  onKill?: (msg: KillMsg) => void
  onMatchState?: (msg: MatchStateMsg) => void
}
let handlers: Handlers = {}

function syncPresenceToStore() {
  if (!channel) return
  const state = channel.presenceState<PresenceMeta>()
  const players: LobbyPlayer[] = []
  const myId = useMultiplayerStore.getState().myPlayerId
  for (const key in state) {
    const metas = state[key]
    // A stale duplicate ref can briefly linger after a reconnect; the most
    // recently joined entry for this key is always the authoritative one.
    const meta = metas[metas.length - 1] as unknown as PresenceMeta | undefined
    if (!meta) continue
    players.push({
      playerId: meta.playerId,
      name: meta.name,
      classId: meta.classId,
      ready: meta.ready,
      isHost: meta.isHost,
    })
    if (meta.playerId !== myId) {
      const remote = getOrCreateRemote(meta.playerId, meta.name, meta.classId)
      remote.name = meta.name
      remote.classId = meta.classId
    }
  }
  // Drop remote state for anyone no longer present.
  const presentIds = new Set(players.map((p) => p.playerId))
  for (const id of remotePlayers.keys()) {
    if (!presentIds.has(id)) remotePlayers.delete(id)
  }
  useMultiplayerStore.getState().setLobbyPlayers(players)
}

function handleMessage(msg: NetMessage) {
  const myId = useMultiplayerStore.getState().myPlayerId

  if (msg.t === 'transform') {
    const m = msg as TransformMsg
    if (m.playerId === myId) return
    const p = remotePlayers.get(m.playerId)
    if (!p || m.seq <= p.lastSeq) return
    p.lastSeq = m.seq
    p.lastRecvTs = performance.now()
    p.targetPos.set(m.pos[0], m.pos[1], m.pos[2])
    p.targetYaw = m.yaw
    p.targetPitch = m.pitch
    p.firing = m.firing
    return
  }

  if (msg.t === 'shot') {
    const m = msg as ShotMsg
    if (m.playerId === myId) return
    const p = remotePlayers.get(m.playerId)
    if (p) {
      p.lastShotDir.set(m.dir[0], m.dir[1], m.dir[2])
      p.burstFlash = 0.12
    }
    return
  }

  if (msg.t === 'health') {
    const p = remotePlayers.get(msg.playerId)
    if (p) {
      p.health = msg.health
      p.alive = msg.alive
      if (!msg.alive) p.hitFlash = 1
    }
    return
  }

  if (msg.t === 'blink') {
    const m = msg as BlinkMsg
    const p = remotePlayers.get(m.playerId)
    if (p) {
      p.targetPos.set(m.pos[0], m.pos[1], m.pos[2])
      p.renderPos.copy(p.targetPos)
      p.invulnUntil = m.invulnUntil
    }
    return
  }

  if (msg.t === 'hit') {
    handlers.onHit?.(msg as HitMsg)
    return
  }

  if (msg.t === 'kill') {
    handlers.onKill?.(msg as KillMsg)
    return
  }

  if (msg.t === 'match_state') {
    handlers.onMatchState?.(msg as MatchStateMsg)
    return
  }
}

export function connectRoom(
  roomCode: string,
  meta: PresenceMeta,
  h: Handlers = {}
): Promise<void> {
  // Guard against a leaked prior connection (e.g. a dev-mode remount) leaving
  // a duplicate presence ref for the same player behind.
  if (channel) disconnectRoom()

  handlers = h
  currentMeta = meta
  resetNetState()
  outSeq = 0
  sendAccum = 0

  channel = supabase.channel(`room:${roomCode}`, {
    config: {
      broadcast: { self: false },
      presence: { key: meta.playerId },
    },
  })

  channel
    .on('broadcast', { event: 'msg' }, ({ payload }: { payload: NetMessage }) =>
      handleMessage(payload)
    )
    .on('presence', { event: 'sync' }, syncPresenceToStore)
    .on('presence', { event: 'join' }, syncPresenceToStore)
    .on('presence', { event: 'leave' }, syncPresenceToStore)

  return new Promise((resolve, reject) => {
    channel!.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel!.track(meta)
        resolve()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error(`Realtime channel failed: ${status}`))
      }
    })
  })
}

export async function updatePresence(patch: Partial<PresenceMeta>) {
  if (!channel || !currentMeta) return
  currentMeta = { ...currentMeta, ...patch }
  await channel.track(currentMeta)
}

export function disconnectRoom() {
  if (channel) {
    supabase.removeChannel(channel)
    channel = null
  }
  currentMeta = null
  resetNetState()
}

/** Called once per frame from the multiplayer Controller; throttles internally to ~18hz. */
export function sendTransform(
  dt: number,
  pos: THREE.Vector3,
  yaw: number,
  pitch: number,
  firing: boolean
) {
  if (!channel) return
  sendAccum += dt
  if (sendAccum < TRANSFORM_INTERVAL) return
  sendAccum = 0
  outSeq++
  const msg: TransformMsg = {
    t: 'transform',
    playerId: useMultiplayerStore.getState().myPlayerId,
    pos: [pos.x, pos.y, pos.z],
    yaw,
    pitch,
    firing,
    seq: outSeq,
    ts: performance.now(),
  }
  void channel.send({ type: 'broadcast', event: 'msg', payload: msg })
}

export function broadcastShot(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  weapon: 'beam' | 'burst'
) {
  if (!channel) return
  const msg: ShotMsg = {
    t: 'shot',
    playerId: useMultiplayerStore.getState().myPlayerId,
    weapon,
    origin: [origin.x, origin.y, origin.z],
    dir: [dir.x, dir.y, dir.z],
    ts: performance.now(),
  }
  void channel.send({ type: 'broadcast', event: 'msg', payload: msg })
}

export function broadcastHit(
  victimId: string,
  damage: number,
  point: THREE.Vector3,
  weapon: 'beam' | 'burst'
) {
  if (!channel) return
  const msg: HitMsg = {
    t: 'hit',
    shooterId: useMultiplayerStore.getState().myPlayerId,
    victimId,
    damage,
    point: [point.x, point.y, point.z],
    weapon,
    ts: performance.now(),
  }
  void channel.send({ type: 'broadcast', event: 'msg', payload: msg })
}

export function broadcastHealth(health: number, alive: boolean) {
  if (!channel) return
  const msg = {
    t: 'health',
    playerId: useMultiplayerStore.getState().myPlayerId,
    health,
    alive,
  } as const
  void channel.send({ type: 'broadcast', event: 'msg', payload: msg })
}

export function broadcastKill(
  victimId: string,
  killerId: string,
  weapon: 'beam' | 'burst'
) {
  if (!channel) return
  const msg: KillMsg = { t: 'kill', victimId, killerId, weapon }
  void channel.send({ type: 'broadcast', event: 'msg', payload: msg })
}

export function broadcastMatchState(
  phase: MatchStateMsg['phase'],
  endsAt: number | null,
  winnerId?: string
) {
  if (!channel) return
  const msg: MatchStateMsg = { t: 'match_state', phase, endsAt, winnerId }
  void channel.send({ type: 'broadcast', event: 'msg', payload: msg })
}

export function broadcastBlink(pos: THREE.Vector3, invulnUntil: number) {
  if (!channel) return
  const msg: BlinkMsg = {
    t: 'blink',
    playerId: useMultiplayerStore.getState().myPlayerId,
    pos: [pos.x, pos.y, pos.z],
    invulnUntil,
  }
  void channel.send({ type: 'broadcast', event: 'msg', payload: msg })
}
