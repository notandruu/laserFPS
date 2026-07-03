'use client'

import * as THREE from 'three'

export interface Enemy {
  id: number
  pos: THREE.Vector3
  hp: number
  maxHp: number
  speed: number
  alive: boolean
  /** 0..1, decays over time; drives the emissive damage flash */
  hitFlash: number
  /** >0 while playing the death pop animation, counts down to 0 then removed */
  dying: number
  /** per-enemy bob/rotation phase */
  phase: number
}

/** Where the player stands (camera). Enemies advance toward this on the XZ plane. */
const PLAYER = new THREE.Vector3(0, 1.6, 6.5)

/** Radius around the beam ray within which an enemy is considered hit (aim forgiveness) */
const HIT_RADIUS = 1.7
/** Distance from the player at which a drone reaches you and deals contact damage */
const CONTACT_DIST = 1.6

const DEATH_TIME = 0.28

const _toPlayer = new THREE.Vector3()
const _rel = new THREE.Vector3()
const _proj = new THREE.Vector3()

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
  spawnWave(wave: number) {
    const count = 3 + wave
    const hp = 26 + (wave - 1) * 14
    const speed = 0.85 + (wave - 1) * 0.14
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() - 0.5) * Math.PI * 0.9
      const dist = 16 + Math.random() * 10
      const x = Math.sin(angle) * dist * 0.6
      const z = PLAYER.z - Math.cos(angle) * dist
      const y = 1.2 + Math.random() * 2.2
      this.enemies.push({
        id: this.nextId++,
        pos: new THREE.Vector3(x, y, z),
        hp,
        maxHp: hp,
        speed: speed + Math.random() * 0.3,
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
  ): { point: THREE.Vector3; killed: boolean } | null {
    let best: Enemy | null = null
    let bestT = Number.POSITIVE_INFINITY

    for (const e of this.enemies) {
      if (!e.alive) continue
      _rel.subVectors(e.pos, origin)
      const t = _rel.dot(dir)
      if (t <= 0) continue // behind the camera
      _proj.copy(dir).multiplyScalar(t).add(origin)
      const perp = _proj.distanceTo(e.pos)
      if (perp <= HIT_RADIUS && t < bestT) {
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
    return { point, killed }
  }

  /**
   * Advance all enemies toward the player and animate death pops.
   * Returns the total contact damage dealt to the player this frame.
   */
  update(delta: number): number {
    let contactDamage = 0

    for (const e of this.enemies) {
      // decay hit flash
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - delta * 4)

      if (!e.alive) {
        if (e.dying > 0) e.dying = Math.max(0, e.dying - delta)
        continue
      }

      // Advance toward the player on all axes
      _toPlayer.subVectors(PLAYER, e.pos)
      const dist = _toPlayer.length()
      if (dist <= CONTACT_DIST) {
        // Reached the player: deal a burst of damage and self-destruct
        contactDamage += 14
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
export const PLAYER_POS = PLAYER
export const DEATH_DURATION = DEATH_TIME
