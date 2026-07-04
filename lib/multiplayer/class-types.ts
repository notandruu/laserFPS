import type * as THREE from 'three'
import type { PlayerMovement } from '@/lib/laser/movement'

export interface ClassDeps {
  camera: THREE.Camera
  selfId: () => string
  isPlaying: () => boolean
  setWeaponCooldown: (v: number) => void
  setAbilityCooldown: (v: number) => void
  movement: PlayerMovement
  clampToArena: () => void
}

export interface ClassRuntime {
  fireDown: () => void
  fireUp: () => void
  useAbility: () => void
  /** Called once per frame from the multiplayer Controller's useFrame */
  tick: (dt: number) => void
}
