'use client'

import * as THREE from 'three'
import { ARENA_RADIUS, PLAYER_HEIGHT, PLAYER_POS } from './world'

export { ARENA_RADIUS, PLAYER_HEIGHT, PLAYER_POS }

export interface Enemy {
  id: number
  kind: EnemyKind
  pos: THREE.Vector3
  hp: number
  maxHp: number
  speed: number
  radius: number
  contactDamage: number
  scoreValue: number
  alive: boolean
  /** 0..1, decays over time; drives the emissive damage flash */
  hitFlash: number
  /** >0 while playing the death pop animation, counts down to 0 then removed */
  dying: number
  /** per-enemy bob/rotation phase */
  phase: number
}

export type EnemyKind = 'drone' | 'charger' | 'tank'

/** Radius around the beam ray within which an enemy is considered hit (aim forgiveness) */
const HIT_RADIUS = 1.7
/** Distance from the player at which a drone reaches you and deals contact damage */
const CONTACT_DIST = 1.6

const DEATH_TIME = 0.28

const _toPlayer = new THREE.Vector3()
const _rel = new THREE.Vector3()
const _proj = new THREE.Vector3()

function pickKind(wave: number, index: number): EnemyKind {
  if (wave >= 4 && index % 6 === 4) return 'tank'
  if (wave >= 2 && index % 3 === 1) return 'charger'
  if (wave >= 5 && Math.random() < 0.18) return 'tank'
  return 'drone'
}

function statsFor(kind: EnemyKind, wave: number) {
  const waveHp = 26 + (wave - 1) * 14
  const waveSpeed = 0.85 + (wave - 1) * 0.14

  if (kind === 'charger') {
    return {
      hp: Math.round(waveHp * 0.72),
      speed: waveSpeed * 1.55 + Math.random() * 0.38,
      radius: 0.78,
      contactDamage: 11,
      scoreValue: 130 + (wave - 1) * 26,
    }
  }

  if (kind === 'tank') {
    return {
      hp: Math.round(waveHp * 2.45),
      speed: waveSpeed * 0.62 + Math.random() * 0.16,
      radius: 1.42,
      contactDamage: 24,
      scoreValue: 280 + (wave - 1) * 38,
    }
  }

  return {
    hp: waveHp,
    speed: waveSpeed + Math.random() * 0.3,
    radius: 1,
    contactDamage: 14,
    scoreValue: 100 + (wave - 1) * 25,
  }
}

class EnemyField {
  enemies: Enemy[] = []
  private nextId = 1
  /** Set to a death position each frame an enemy dies, for the scene to burst sparks */
  lastKillPos: THREE.Vector3 | null = null

  reset() {
    this.enemies = []
    this.nextId = 1
    this.lastKillPos = null
  }

  /** Spawn a full wave. Count / hp / speed scale with the wave number. */
  spawnWave(wave: number, playerPos: THREE.Vector3 = PLAYER_POS) {
    const count = 3 + wave
    for (let i = 0; i < count; i++) {
      const kind = pickKind(wave, i)
      const stats = statsFor(kind, wave)
      const angle = Math.random() * Math.PI * 2
      const dist = 16 + Math.random() * 10
      const x = THREE.MathUtils.clamp(
        playerPos.x + Math.cos(angle) * dist,
        -ARENA_RADIUS,
        ARENA_RADIUS
      )
      const z = THREE.MathUtils.clamp(
        playerPos.z + Math.sin(angle) * dist,
        -ARENA_RADIUS,
        ARENA_RADIUS
      )
      const y = 1.0 + stats.radius * 0.8 + Math.random() * 1.8
      this.enemies.push({
        id: this.nextId++,
        kind,
        pos: new THREE.Vector3(x, y, z),
        hp: stats.hp,
        maxHp: stats.hp,
        speed: stats.speed,
        radius: stats.radius,
        contactDamage: stats.contactDamage,
        scoreValue: stats.scoreValue,
        alive: true,
        hitFlash: 0,
        dying: 0,
        phase: Math.random() * Math.PI * 2,
      })
    }
  }

  /** Number of enemies still alive (not dying/dead) */
  aliveCount() {
    let n = 0
    for (const e of this.enemies) if (e.alive) n++
    return n
  }

  /**
   * Apply damage-over-time to the first enemy under the given ray.
   * Returns the world-space hit point if something was hit, else null.
   */
  damageAt(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    dmg: number
  ): { point: THREE.Vector3; killed: boolean; scoreValue: number } | null {
    let best: Enemy | null = null
    let bestT = Number.POSITIVE_INFINITY

    for (const e of this.enemies) {
      if (!e.alive) continue
      _rel.subVectors(e.pos, origin)
      const t = _rel.dot(dir)
      if (t <= 0) continue // behind the camera
      _proj.copy(dir).multiplyScalar(t).add(origin)
      const perp = _proj.distanceTo(e.pos)
      if (perp <= HIT_RADIUS * e.radius && t < bestT) {
        bestT = t
        best = e
      }
    }

    if (!best) return null

    best.hp -= dmg
    best.hitFlash = 1
    let killed = false
    if (best.hp <= 0 && best.dying === 0 && best.alive) {
      best.alive = false
      best.dying = DEATH_TIME
      this.lastKillPos = best.pos.clone()
      killed = true
    }

    const point = new THREE.Vector3()
      .copy(dir)
      .multiplyScalar(bestT)
      .add(origin)
    return { point, killed, scoreValue: best.scoreValue }
  }

  /**
   * Advance all enemies toward the player and animate death pops.
   * Returns the total contact damage dealt to the player this frame.
   */
  update(delta: number, playerPos: THREE.Vector3 = PLAYER_POS): number {
    let contactDamage = 0

    for (const e of this.enemies) {
      // decay hit flash
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - delta * 4)

      if (!e.alive) {
        if (e.dying > 0) e.dying = Math.max(0, e.dying - delta)
        continue
      }

      // Advance toward the live player position on all axes
      _toPlayer.subVectors(playerPos, e.pos)
      const dist = _toPlayer.length()
      if (dist <= CONTACT_DIST * e.radius) {
        // Reached the player: deal a burst of damage and self-destruct
        contactDamage += e.contactDamage
        e.alive = false
        e.dying = DEATH_TIME
        continue
      }
      _toPlayer.normalize()
      // bob slightly while advancing
      e.pos.addScaledVector(_toPlayer, e.speed * delta)
      e.pos.y += Math.sin((performance.now() / 1000) * 2 + e.phase) * delta * 0.25
    }

    // Remove fully dead enemies
    this.enemies = this.enemies.filter((e) => e.alive || e.dying > 0)

    return contactDamage
  }
}

export const enemyField = new EnemyField()
export const DEATH_DURATION = DEATH_TIME
