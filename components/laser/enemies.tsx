'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DEATH_DURATION, PLAYER_POS, enemyField } from '@/lib/laser/enemies'

const POOL_SIZE = 48

interface DroneRefs {
  group: THREE.Group
  body: THREE.Mesh
  bodyMat: THREE.MeshStandardMaterial
  eyeL: THREE.MeshBasicMaterial
  eyeR: THREE.MeshBasicMaterial
  ring: THREE.Mesh
  ringMat: THREE.MeshBasicMaterial
}

/** A single reusable drone in the pool */
function Drone({ register }: { register: (r: DroneRefs | null) => void }) {
  const group = useRef<THREE.Group>(null)
  const body = useRef<THREE.Mesh>(null)
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null)
  const eyeL = useRef<THREE.MeshBasicMaterial>(null)
  const eyeR = useRef<THREE.MeshBasicMaterial>(null)
  const ring = useRef<THREE.Mesh>(null)
  const ringMat = useRef<THREE.MeshBasicMaterial>(null)

  useEffect(() => {
    if (
      group.current &&
      body.current &&
      bodyMat.current &&
      eyeL.current &&
      eyeR.current &&
      ring.current &&
      ringMat.current
    ) {
      register({
        group: group.current,
        body: body.current,
        bodyMat: bodyMat.current,
        eyeL: eyeL.current,
        eyeR: eyeR.current,
        ring: ring.current,
        ringMat: ringMat.current,
      })
    }
    return () => register(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <group ref={group} visible={false}>
      {/* Faceted dark body */}
      <mesh ref={body}>
        <icosahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial
          ref={bodyMat}
          color="#0a0a0a"
          emissive="#ffffff"
          emissiveIntensity={0}
          roughness={0.35}
          metalness={0.6}
          flatShading
        />
      </mesh>
      {/* Halo ring, reads as a hostile drone silhouette */}
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.62, 0.03, 8, 32]} />
        <meshBasicMaterial ref={ringMat} color="#ffffff" toneMapped={false} />
      </mesh>
      {/* Two glowing eyes */}
      <mesh position={[-0.16, 0.08, 0.46]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial ref={eyeL} color={[4, 4, 4]} toneMapped={false} />
      </mesh>
      <mesh position={[0.16, 0.08, 0.46]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial ref={eyeR} color={[4, 4, 4]} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function Enemies() {
  const pool = useRef<(DroneRefs | null)[]>([])

  const slots = useMemo(() => Array.from({ length: POOL_SIZE }, (_, i) => i), [])

  useFrame(() => {
    const list = enemyField.enemies
    for (let i = 0; i < POOL_SIZE; i++) {
      const refs = pool.current[i]
      if (!refs) continue
      const e = list[i]
      if (!e) {
        refs.group.visible = false
        continue
      }

      refs.group.visible = true
      refs.group.position.copy(e.pos)
      refs.group.lookAt(PLAYER_POS)
      refs.group.rotation.x = Math.sin(e.phase + performance.now() / 1400) * 0.2
      refs.bodyMat.color.set(e.kind === 'tank' ? '#12100b' : '#0a0a0a')
      refs.bodyMat.emissive.set(e.kind === 'charger' ? '#8fdfff' : '#ffffff')
      refs.eyeL.color.set(e.kind === 'tank' ? '#fff1a8' : e.kind === 'charger' ? '#9be8ff' : '#ffffff')
      refs.eyeR.color.copy(refs.eyeL.color)
      refs.ring.scale.setScalar(e.kind === 'tank' ? 1.12 : e.kind === 'charger' ? 0.86 : 1)

      // Death pop: scale up + fade out as `dying` counts down
      let scale = 1
      if (!e.alive && e.dying > 0) {
        const p = 1 - e.dying / DEATH_DURATION // 0 -> 1
        scale = 1 + p * 1.4
        const fade = 1 - p
        refs.eyeL.opacity = fade
        refs.eyeR.opacity = fade
        refs.eyeL.transparent = true
        refs.eyeR.transparent = true
        refs.ringMat.opacity = fade
        refs.ringMat.transparent = true
        refs.bodyMat.emissiveIntensity = 2.5 * fade
      } else {
        refs.eyeL.opacity = 1
        refs.eyeR.opacity = 1
        refs.ringMat.opacity = 1
        // Pulse the health-based glow + damage flash
        const hpFrac = Math.max(0, e.hp / e.maxHp)
        const heat = 0.5 + (1 - hpFrac) * 0.8
        if (e.kind === 'charger') refs.ringMat.color.setRGB(0.38 * heat, 0.86 * heat, heat)
        else if (e.kind === 'tank') refs.ringMat.color.setRGB(heat, 0.82 * heat, 0.38 * heat)
        else refs.ringMat.color.setScalar(heat)
        refs.bodyMat.emissiveIntensity =
          e.hitFlash * (e.kind === 'tank' ? 4.4 : e.kind === 'charger' ? 4 : 3.5)
      }
      refs.group.scale.setScalar(scale * e.radius)
    }
  })

  return (
    <group>
      {slots.map((i) => (
        <Drone
          key={i}
          register={(r) => {
            pool.current[i] = r
          }}
        />
      ))}
    </group>
  )
}
