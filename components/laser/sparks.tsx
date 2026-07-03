'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { laserState } from '@/lib/laser/store'

const COUNT = 160

/** White-hot sparks spraying off the impact point */
export function Sparks() {
  const pointsRef = useRef<THREE.Points>(null)

  const { positions, velocities, life } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    positions.fill(-9999)
    return {
      positions,
      velocities: new Float32Array(COUNT * 3),
      life: new Float32Array(COUNT),
    }
  }, [])

  const cursor = useRef(0)

  useFrame((_, delta) => {
    const points = pointsRef.current
    if (!points) return
    const posAttr = points.geometry.attributes.position as THREE.BufferAttribute

    // Spawn while firing
    if (laserState.firing && laserState.hasHit) {
      const spawn = 4
      for (let s = 0; s < spawn; s++) {
        const i = cursor.current
        cursor.current = (cursor.current + 1) % COUNT
        positions[i * 3] = laserState.hitPoint.x
        positions[i * 3 + 1] = laserState.hitPoint.y
        positions[i * 3 + 2] = laserState.hitPoint.z + 0.03
        const a = Math.random() * Math.PI * 2
        const speed = 0.6 + Math.random() * 1.8
        velocities[i * 3] = Math.cos(a) * speed * 0.7
        velocities[i * 3 + 1] = Math.sin(a) * speed * 0.7 + 0.6
        velocities[i * 3 + 2] = 0.4 + Math.random() * 1.4
        life[i] = 0.35 + Math.random() * 0.45
      }
    }

    // Integrate
    for (let i = 0; i < COUNT; i++) {
      if (life[i] <= 0) continue
      life[i] -= delta
      if (life[i] <= 0) {
        positions[i * 3 + 1] = -9999
        continue
      }
      velocities[i * 3 + 1] -= 5.5 * delta // gravity
      positions[i * 3] += velocities[i * 3] * delta
      positions[i * 3 + 1] += velocities[i * 3 + 1] * delta
      positions[i * 3 + 2] += velocities[i * 3 + 2] * delta
    }

    posAttr.copyArray(positions)
    posAttr.needsUpdate = true
  })

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={[3, 3, 3]}
        size={0.035}
        sizeAttenuation
        transparent
        opacity={0.9}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}
