'use client'

import * as THREE from 'three'
import { laserAudio } from '@/lib/laser/audio'
import { ARENA_RADIUS, PLAYER_HEIGHT, PLAYER_POS } from '@/lib/laser/world'
import { useMultiplayerStore, type ScoreboardEntry } from './mp-store'
import { remotePlayers } from './net-state'
import { broadcastHealth, broadcastKill, broadcastMatchState } from './net-sync'
import type { HitMsg, KillMsg, MatchStateMsg } from './messages'

export const MATCH_TIME_LIMIT_S = 300
export const MAX_KILLS = 15
const RESPAWN_DELAY_MS = 2000
const COUNTDOWN_MS = 3000

let respawnTimer: ReturnType<typeof setTimeout> | null = null

export function randomSpawnPoint(): THREE.Vector3 {
  const angle = Math.random() * Math.PI * 2
  const dist = Math.random() * (ARENA_RADIUS - 3)
  return new THREE.Vector3(Math.cos(angle) * dist, PLAYER_HEIGHT, Math.sin(angle) * dist)
}

function declareWinner(winnerId: string) {
  const store = useMultiplayerStore.getState()
  store.setMatchPhase('ended')
  store.setWinner(winnerId)
  store.setMatchEnd(null)
  broadcastMatchState('ended', null, winnerId)
}

function leaderId(): string {
  const store = useMultiplayerStore.getState()
  let bestId = store.myPlayerId
  let bestKills = store.kills
  for (const p of remotePlayers.values()) {
    if (p.kills > bestKills) {
      bestKills = p.kills
      bestId = p.playerId
    }
  }
  return bestId
}

/** Shooter broadcast a HitMsg; only the victim's own client applies/authoritative-syncs health. */
export function handleHit(msg: HitMsg) {
  const store = useMultiplayerStore.getState()
  if (msg.victimId !== store.myPlayerId) return
  if (!store.alive) return

  laserAudio.hurt()
  const nextHealth = Math.max(0, store.health - msg.damage)

  if (nextHealth <= 0) {
    store.setHealth(0, false)
    broadcastHealth(0, false)
    broadcastKill(store.myPlayerId, msg.shooterId, msg.weapon)
    store.setKillsDeaths(store.kills, store.deaths + 1)
    if (respawnTimer) clearTimeout(respawnTimer)
    respawnTimer = setTimeout(() => {
      PLAYER_POS.copy(randomSpawnPoint())
      const s = useMultiplayerStore.getState()
      if (s.matchPhase !== 'active') return
      s.setHealth(s.maxHealth, true)
      broadcastHealth(s.maxHealth, true)
    }, RESPAWN_DELAY_MS)
  } else {
    store.takeDamage(msg.damage)
    broadcastHealth(nextHealth, true)
  }
}

/** KillMsg is broadcast to everyone, so every client keeps its own scoreboard view current. */
export function handleKill(msg: KillMsg) {
  const store = useMultiplayerStore.getState()

  if (msg.killerId === store.myPlayerId) {
    const kills = store.kills + 1
    store.setKillsDeaths(kills, store.deaths)
    laserAudio.blip(90)
    if (kills >= MAX_KILLS) declareWinner(store.myPlayerId)
  }

  const killer = remotePlayers.get(msg.killerId)
  if (killer) killer.kills += 1
  const victim = remotePlayers.get(msg.victimId)
  if (victim) victim.deaths += 1
}

export function handleMatchState(msg: MatchStateMsg) {
  const store = useMultiplayerStore.getState()
  store.setMatchPhase(msg.phase)
  store.setMatchEnd(msg.endsAt)
  if (msg.winnerId) store.setWinner(msg.winnerId)
}

/** Host-initiated: kick off the pre-match countdown for everyone. */
export function startCountdown() {
  const endsAt = Date.now() + COUNTDOWN_MS
  useMultiplayerStore.getState().setMatchPhase('countdown')
  useMultiplayerStore.getState().setMatchEnd(endsAt)
  broadcastMatchState('countdown', endsAt)
}

/**
 * Runs on a plain interval (not tied to the R3F frame loop, so it keeps working
 * through the lobby/countdown before the scene is even mounted). Flips
 * countdown -> active locally once the deadline passes, and active -> ended
 * when the time limit runs out.
 */
export function tickMatchClock() {
  const store = useMultiplayerStore.getState()
  const now = Date.now()

  if (store.matchPhase === 'countdown' && store.matchEndsAt !== null && now >= store.matchEndsAt) {
    store.resetForMatch()
    store.setMatchPhase('active')
    store.setMatchEnd(now + MATCH_TIME_LIMIT_S * 1000)
    PLAYER_POS.copy(randomSpawnPoint())
    return
  }

  // Only the host decides the timeout winner — every client's own view of
  // "everyone's kills" depends on having received each KillMsg broadcast, and
  // letting every client race to declare independently can pick an outcome
  // based on whichever client's view happened to be stalest.
  if (
    store.isHost &&
    store.matchPhase === 'active' &&
    store.matchEndsAt !== null &&
    now >= store.matchEndsAt
  ) {
    declareWinner(leaderId())
  }
}

export function buildScoreboard(): ScoreboardEntry[] {
  const store = useMultiplayerStore.getState()
  const entries: ScoreboardEntry[] = [
    {
      playerId: store.myPlayerId,
      name: store.myName,
      classId: store.myClass,
      kills: store.kills,
      deaths: store.deaths,
      isLocal: true,
    },
  ]
  for (const p of remotePlayers.values()) {
    entries.push({
      playerId: p.playerId,
      name: p.name,
      classId: p.classId,
      kills: p.kills,
      deaths: p.deaths,
      isLocal: false,
    })
  }
  entries.sort((a, b) => b.kills - a.kills)
  return entries
}
