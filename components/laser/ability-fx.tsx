'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { laserState } from '@/lib/laser/store'

const DASH_STREAK_LIFE = 0.25
const DASH_FOV_KICK = 12
const DASH_FOV_EASE = 0.35
const BLINK_RING_LIFE = 0.2

const _from = new THREE.Vector3()
const _to = new THREE.Vector3()
const _mid = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

/** Plain helper (not a direct in-component assignment) so mutating the R3F camera each frame is safe. */
function applyFov(cam: THREE.PerspectiveCamera, fov: number) {
  cam.fov = fov
  cam.updateProjectionMatrix()
}

/**
 * Watches laserState.abilityAt for one-shot dash/blink effects: a fading
 * speed-streak + camera FOV kick for dash, expanding phase-rings for blink.
 */
export function AbilityFx() {
  const { camera } = useThree()
  const lastAbilityAt = useRef(0)

  const streakRef = useRef<THREE.Mesh>(null)
  const streakMat = useRef<THREE.MeshBasicMaterial>(null)
  const streakLife = useRef(0)

  const ringFromRef = useRef<THREE.Mesh>(null)
  const ringFromMat = useRef<THREE.MeshBasicMaterial>(null)
  const ringToRef = useRef<THREE.Mesh>(null)
  const ringToMat = useRef<THREE.MeshBasicMaterial>(null)
  const ringLife = useRef(0)

  const baseFov = useRef<number | null>(null)
  const fovKick = useRef(0)

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.05)
    const persCam = camera as THREE.PerspectiveCamera
    if (baseFov.current === null) baseFov.current = persCam.fov

    if (laserState.abilityAt !== lastAbilityAt.current) {
      lastAbilityAt.current = laserState.abilityAt
      _from.set(laserState.abilityFrom.x, laserState.abilityFrom.y, laserState.abilityFrom.z)
      _to.set(laserState.abilityTo.x, laserState.abilityTo.y, laserState.abilityTo.z)

      if (laserState.abilityKind === 'dash') {
        streakLife.current = DASH_STREAK_LIFE
        fovKick.current = 1
        if (streakRef.current) {
          const len = Math.max(0.01, _from.distanceTo(_to))
          _dir.subVectors(_to, _from).normalize()
          _mid.addVectors(_from, _to).multiplyScalar(0.5)
          streakRef.current.position.copy(_mid)
          streakRef.current.scale.set(1, len, 1)
          streakRef.current.quaternion.setFromUnitVectors(_up, _dir)
        }
      } else if (laserState.abilityKind === 'blink') {
        ringLife.current = BLINK_RING_LIFE
        if (ringFromRef.current) ringFromRef.current.position.copy(_from)
        if (ringToRef.current) ringToRef.current.position.copy(_to)
      }
    }

    // Dash streak fade
    if (streakLife.current > 0) {
      streakLife.current = Math.max(0, streakLife.current - dt)
      const t = 1 - streakLife.current / DASH_STREAK_LIFE
      if (streakMat.current) streakMat.current.opacity = (1 - t) * 0.85
      if (streakRef.current) streakRef.current.visible = true
    } else if (streakRef.current) {
      streakRef.current.visible = false
    }

    // Dash FOV kick, punches out then eases back to base
    if (fovKick.current > 0 || Math.abs(persCam.fov - (baseFov.current ?? persCam.fov)) > 0.01) {
      fovKick.current = Math.max(0, fovKick.current - dt / DASH_FOV_EASE)
      const target = (baseFov.current ?? persCam.fov) + DASH_FOV_KICK * fovKick.current
      applyFov(persCam, THREE.MathUtils.lerp(persCam.fov, target, Math.min(1, dt * 10)))
    }

    // Blink rings expand + fade
    if (ringLife.current > 0) {
      ringLife.current = Math.max(0, ringLife.current - dt)
      const t = 1 - ringLife.current / BLINK_RING_LIFE
      const scale = THREE.MathUtils.lerp(0.3, 2, t)
      const opacity = 1 - t
      for (const [mesh, mat] of [
        [ringFromRef.current, ringFromMat.current],
        [ringToRef.current, ringToMat.current],
      ] as const) {
        if (!mesh || !mat) continue
        mesh.visible = true
        mesh.scale.setScalar(scale)
        mat.opacity = opacity
      }
    } else {
      if (ringFromRef.current) ringFromRef.current.visible = false
      if (ringToRef.current) ringToRef.current.visible = false
    }
  })

  return (
    <>
      {/* Dash speed-streak */}
      <mesh ref={streakRef} visible={false}>
        <cylinderGeometry args={[0.05, 0.02, 1, 10, 1, true]} />
        <meshBasicMaterial
          ref={streakMat}
          color="#ffffff"
          transparent
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Blink phase rings */}
      <mesh ref={ringFromRef} visible={false} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.6, 0.04, 8, 32]} />
        <meshBasicMaterial
          ref={ringFromMat}
          color="#c98bff"
          transparent
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ringToRef} visible={false} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.6, 0.04, 8, 32]} />
        <meshBasicMaterial
          ref={ringToMat}
          color="#c98bff"
          transparent
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}
