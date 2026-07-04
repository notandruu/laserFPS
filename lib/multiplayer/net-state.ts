'use client'

import * as THREE from 'three'
import type { ClassId } from './classes'

export interface RemotePlayerState {
  playerId: string
  name: string
  classId: ClassId
  // Last authoritative snapshot received over the network.
  targetPos: THREE.Vector3
  targetYaw: number
  targetPitch: number
  lastSeq: number
  lastRecvTs: number
  // Smoothed, what the renderer/hit-test actually reads each frame.
  renderPos: THREE.Vector3
  renderYaw: number
  renderPitch: number
  health: number
  maxHealth: number
  alive: boolean
  kills: number
  deaths: number
  /** >0 while a hit-flash/death animation should show, decays over time */
  hitFlash: number
  /** >0 while blink invulnerability is active (Class B) */
  invulnUntil: number
  /** True while this player's beam (Class A) is actively held down */
  firing: boolean
  /** >0 while a burst-shot (Class B) tracer flash should show, decays over time */
  burstFlash: number
  /** Direction of the most recent burst shot, for the tracer visual */
  lastShotDir: THREE.Vector3
}

/** Keyed by playerId. Plain mutable map, not React/Zustand state — read every frame. */
export const remotePlayers = new Map<string, RemotePlayerState>()

export function getOrCreateRemote(
  playerId: string,
  name: string,
  classId: ClassId
): RemotePlayerState {
  let p = remotePlayers.get(playerId)
  if (!p) {
    p = {
      playerId,
      name,
      classId,
      targetPos: new THREE.Vector3(0, 1.6, 0),
      targetYaw: 0,
      targetPitch: 0,
      lastSeq: -1,
      lastRecvTs: 0,
      renderPos: new THREE.Vector3(0, 1.6, 0),
      renderYaw: 0,
      renderPitch: 0,
      health: 100,
      maxHealth: 100,
      alive: true,
      kills: 0,
      deaths: 0,
      hitFlash: 0,
      invulnUntil: 0,
      firing: false,
      burstFlash: 0,
      lastShotDir: new THREE.Vector3(0, 0, -1),
    }
    remotePlayers.set(playerId, p)
  }
  return p
}

/** Local player's own outbound-throttling bookkeeping, mirrors laserState's role. */
export const myNetState = {
  seq: 0,
  lastSentTs: 0,
  invulnUntil: 0,
}

export function resetNetState() {
  remotePlayers.clear()
  myNetState.seq = 0
  myNetState.lastSentTs = 0
  myNetState.invulnUntil = 0
}
