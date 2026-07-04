import * as THREE from 'three'

/** How long a dash takes to cover its distance, eased out (fast start, gentle stop). */
export const DASH_DURATION = 0.16

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Tracks an in-progress dash slide so a fixed distance is covered smoothly over
 * DASH_DURATION instead of teleporting there in one frame. Shared by solo mode
 * and multiplayer's Class A so the two don't reimplement the same easing twice.
 */
export class DashSlide {
  active = false
  private elapsed = 0
  private distanceSoFar = 0
  private totalDistance = 0
  private dir = new THREE.Vector3()

  start(dir: THREE.Vector3, distance: number) {
    this.active = true
    this.elapsed = 0
    this.distanceSoFar = 0
    this.totalDistance = distance
    this.dir.copy(dir)
  }

  /** Advances `pos` in place by this frame's share of the eased distance. */
  advance(dt: number, pos: THREE.Vector3): void {
    if (!this.active) return
    this.elapsed += dt
    const t = Math.min(1, this.elapsed / DASH_DURATION)
    const target = this.totalDistance * easeOutCubic(t)
    const delta = target - this.distanceSoFar
    if (delta > 0) pos.addScaledVector(this.dir, delta)
    this.distanceSoFar = target
    if (t >= 1) this.active = false
  }
}
