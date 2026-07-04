'use client'

import * as THREE from 'three'
import { remotePlayers } from './net-state'

/** Chest-height hit-sphere radius, standing in for a real capsule test (matches the
 *  aim-forgiveness approach EnemyField.damageAt already uses against drones). */
const HIT_RADIUS = 0.9

const _rel = new THREE.Vector3()
const _proj = new THREE.Vector3()

/**
 * Shooter-authoritative ray-vs-player hit test against everyone else's
 * interpolated render position (so what the shooter sees is what gets hit).
 * Returns the first remote player struck, or null.
 */
export function damagePlayerAt(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  selfId: string
): { victimId: string; point: THREE.Vector3 } | null {
  let bestId: string | null = null
  let bestT = Number.POSITIVE_INFINITY

  for (const p of remotePlayers.values()) {
    if (p.playerId === selfId || !p.alive) continue
    if (p.invulnUntil > performance.now()) continue

    _rel.subVectors(p.renderPos, origin)
    const t = _rel.dot(dir)
    if (t <= 0) continue
    _proj.copy(dir).multiplyScalar(t).add(origin)
    const perp = _proj.distanceTo(p.renderPos)
    if (perp <= HIT_RADIUS && t < bestT) {
      bestT = t
      bestId = p.playerId
    }
  }

  if (!bestId) return null
  const point = new THREE.Vector3().copy(dir).multiplyScalar(bestT).add(origin)
  return { victimId: bestId, point }
}
