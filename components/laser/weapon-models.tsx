'use client'

import { useFrame } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { laserState } from '@/lib/laser/store'

export interface WeaponModelProps {
  tipRef?: RefObject<THREE.Mesh | null>
  /**
   * External material ref for the accent glow ring. If provided, the caller is
   * responsible for driving its emissiveIntensity (e.g. remote players pulse it
   * from their own network-synced firing state). If omitted, the model self-pulses
   * based on the local player's own `laserState` — correct for the first-person view.
   */
  glowRef?: RefObject<THREE.MeshStandardMaterial | null>
  accentColor?: string
}

/** Emissive ring pulses gently when idle, brightens while actively firing. */
function useMuzzleGlowPulse(
  ringRef: RefObject<THREE.MeshStandardMaterial | null>,
  enabled: boolean
) {
  useFrame((state) => {
    if (!enabled || !ringRef.current) return
    const active = (laserState.firing && laserState.hasHit) || laserState.pulseFlash > 0
    const pulse = active
      ? 2.4 + Math.sin(state.clock.elapsedTime * 30) * 0.6
      : 0.5 + Math.sin(state.clock.elapsedTime * 2) * 0.2
    ringRef.current.emissiveIntensity = pulse
  })
}

/** Sleek single-barrel pistol: the continuous-beam weapon (solo beam, Striker). */
export function BeamWeaponModel({ tipRef, glowRef, accentColor = '#ffffff' }: WeaponModelProps) {
  const internalRingRef = useRef<THREE.MeshStandardMaterial>(null)
  const ringRef = glowRef ?? internalRingRef
  useMuzzleGlowPulse(ringRef, !glowRef)

  return (
    <group>
      {/* Main body */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.034, 0.04, 0.36, 24]} />
        <meshStandardMaterial color="#0c0c0c" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Grip knurling band */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.08]}>
        <cylinderGeometry args={[0.042, 0.042, 0.1, 24]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0.2} />
      </mesh>
      {/* Accent ring near the tip */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.13]}>
        <cylinderGeometry args={[0.037, 0.037, 0.018, 24]} />
        <meshStandardMaterial
          ref={ringRef}
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={0.5}
          toneMapped={false}
        />
      </mesh>
      {/* Tapered nose */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.2]}>
        <cylinderGeometry args={[0.022, 0.034, 0.08, 24]} />
        <meshStandardMaterial color="#080808" roughness={0.25} metalness={0.9} />
      </mesh>
      {/* Emitter tip, beam origin */}
      <mesh ref={tipRef} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.245]}>
        <cylinderGeometry args={[0.012, 0.018, 0.02, 16]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
      {/* Tail cap */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.19]}>
        <sphereGeometry args={[0.038, 18, 18]} />
        <meshStandardMaterial color="#101010" roughness={0.4} metalness={0.7} />
      </mesh>
    </group>
  )
}

/** Bulkier triple-barrel cluster: the burst-fire weapon (solo pulse, Phantom). */
export function BurstWeaponModel({ tipRef, glowRef, accentColor = '#8fdfff' }: WeaponModelProps) {
  const internalRingRef = useRef<THREE.MeshStandardMaterial>(null)
  const ringRef = glowRef ?? internalRingRef
  useMuzzleGlowPulse(ringRef, !glowRef)

  const barrelOffsets: [number, number][] = [
    [0, 0.024],
    [-0.021, -0.012],
    [0.021, -0.012],
  ]

  return (
    <group>
      {/* Bulkier main body */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]}>
        <boxGeometry args={[0.09, 0.07, 0.3]} />
        <meshStandardMaterial color="#0c0c0c" roughness={0.35} metalness={0.75} flatShading />
      </mesh>
      {/* Grip */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.1]}>
        <cylinderGeometry args={[0.044, 0.044, 0.11, 20]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0.2} />
      </mesh>
      {/* Foregrip nub */}
      <mesh position={[0, -0.05, -0.08]}>
        <boxGeometry args={[0.05, 0.06, 0.08]} />
        <meshStandardMaterial color="#141414" roughness={0.8} flatShading />
      </mesh>
      {/* Accent collar behind the barrel cluster */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.14]}>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 4]} />
        <meshStandardMaterial
          ref={ringRef}
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={0.5}
          toneMapped={false}
          flatShading
        />
      </mesh>
      {/* Triple-barrel cluster */}
      {barrelOffsets.map(([x, y], i) => (
        <mesh key={i} rotation={[Math.PI / 2, 0, 0]} position={[x, y, -0.28]}>
          <cylinderGeometry args={[0.016, 0.02, 0.24, 12]} />
          <meshStandardMaterial color="#080808" roughness={0.25} metalness={0.9} />
        </mesh>
      ))}
      {/* Emitter tip (center barrel), beam/shot origin */}
      <mesh ref={tipRef} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.024, -0.4]}>
        <cylinderGeometry args={[0.01, 0.016, 0.02, 12]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
