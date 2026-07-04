'use client'

import { Billboard, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { remotePlayers } from '@/lib/multiplayer/net-state'
import { CLASSES } from '@/lib/multiplayer/classes'
import { BeamWeaponModel, BurstWeaponModel } from '@/components/laser/weapon-models'

const POOL_SIZE = 8
const NAME_REFRESH_INTERVAL = 0.5
const BEAM_RANGE = 26

const _dir = new THREE.Vector3()
const _tipWorld = new THREE.Vector3()
const _mid = new THREE.Vector3()
const _end = new THREE.Vector3()

/** yaw/pitch (YXZ order, matches the camera) -> forward direction */
function aimDirection(out: THREE.Vector3, yaw: number, pitch: number) {
  out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))
  return out
}

interface SlotRefs {
  group: THREE.Group
  bodyMat: THREE.MeshStandardMaterial
  gunPivot: THREE.Group
  beamGunGroup: THREE.Group
  beamGlowMat: THREE.MeshStandardMaterial
  burstGunGroup: THREE.Group
  burstGlowMat: THREE.MeshStandardMaterial
  beam: THREE.Mesh
  beamMat: THREE.MeshBasicMaterial
}

/** A blocky humanoid rig: head/torso/hips/legs/off-arm are static, the gun arm tilts with aim pitch. */
function RemoteSlot({
  name,
  register,
}: {
  name: string
  register: (r: SlotRefs | null) => void
}) {
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null)
  const gunPivot = useRef<THREE.Group>(null)
  const beamGunGroup = useRef<THREE.Group>(null)
  const beamGlowMat = useRef<THREE.MeshStandardMaterial>(null)
  const burstGunGroup = useRef<THREE.Group>(null)
  const burstGlowMat = useRef<THREE.MeshStandardMaterial>(null)
  const beam = useRef<THREE.Mesh>(null)
  const beamMat = useRef<THREE.MeshBasicMaterial>(null)

  return (
    <group
      ref={(g) => {
        if (
          g &&
          bodyMat.current &&
          gunPivot.current &&
          beamGunGroup.current &&
          beamGlowMat.current &&
          burstGunGroup.current &&
          burstGlowMat.current &&
          beam.current &&
          beamMat.current
        ) {
          register({
            group: g,
            bodyMat: bodyMat.current,
            gunPivot: gunPivot.current,
            beamGunGroup: beamGunGroup.current,
            beamGlowMat: beamGlowMat.current,
            burstGunGroup: burstGunGroup.current,
            burstGlowMat: burstGlowMat.current,
            beam: beam.current,
            beamMat: beamMat.current,
          })
        } else {
          register(null)
        }
      }}
      visible={false}
    >
      {/* Head */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.26, 0.28, 0.26]} />
        <meshStandardMaterial ref={bodyMat} color="#0a0a0a" roughness={0.5} metalness={0.4} flatShading />
      </mesh>
      {/* Torso */}
      <mesh position={[0, -0.46, 0]} castShadow>
        <boxGeometry args={[0.5, 0.55, 0.3]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.5} metalness={0.4} flatShading />
      </mesh>
      {/* Hips */}
      <mesh position={[0, -0.82, 0]} castShadow>
        <boxGeometry args={[0.42, 0.22, 0.28]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.5} metalness={0.4} flatShading />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.13, -1.2, 0]} castShadow>
        <boxGeometry args={[0.17, 0.75, 0.18]} />
        <meshStandardMaterial color="#080808" roughness={0.6} flatShading />
      </mesh>
      <mesh position={[0.13, -1.2, 0]} castShadow>
        <boxGeometry args={[0.17, 0.75, 0.18]} />
        <meshStandardMaterial color="#080808" roughness={0.6} flatShading />
      </mesh>
      {/* Off-hand arm, resting on the foregrip */}
      <mesh position={[-0.28, -0.55, -0.12]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.14, 0.5, 0.14]} />
        <meshStandardMaterial color="#080808" roughness={0.6} flatShading />
      </mesh>

      {/* Gun arm, tilts with aim pitch. Both weapon models are always mounted and
          toggled by visibility so switching class never remounts/re-registers refs. */}
      <group ref={gunPivot} position={[0.3, -0.35, 0]}>
        <mesh position={[0, -0.05, -0.15]} rotation={[0.5, 0, 0]} castShadow>
          <boxGeometry args={[0.14, 0.45, 0.14]} />
          <meshStandardMaterial color="#080808" roughness={0.6} flatShading />
        </mesh>

        <group ref={beamGunGroup} position={[0, -0.1, -0.6]}>
          <BeamWeaponModel glowRef={beamGlowMat} accentColor={CLASSES.A.accentColor} />
        </group>
        <group ref={burstGunGroup} position={[0, -0.1, -0.6]}>
          <BurstWeaponModel glowRef={burstGlowMat} accentColor={CLASSES.B.accentColor} />
        </group>
      </group>

      {/* Beam / burst tracer, shared since a slot is only ever one class at a time */}
      <mesh ref={beam} visible={false}>
        <cylinderGeometry args={[0.03, 0.015, 1, 8, 1, true]} />
        <meshBasicMaterial
          ref={beamMat}
          color={[4, 4, 4]}
          transparent
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {name && (
        <Billboard position={[0, 0.32, 0]}>
          <Text
            fontSize={0.22}
            color="#ffffff"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.01}
            outlineColor="#000000"
          >
            {name}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

export function RemotePlayers() {
  const pool = useRef<(SlotRefs | null)[]>([])
  const slots = useMemo(() => Array.from({ length: POOL_SIZE }, (_, i) => i), [])
  const slotOrder = useRef<string[]>([])
  const [slotNames, setSlotNames] = useState<string[]>(() => Array(POOL_SIZE).fill(''))
  const nameTimer = useRef(0)

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.05)
    const ids = Array.from(remotePlayers.keys())
    slotOrder.current = ids

    nameTimer.current += dt
    if (nameTimer.current >= NAME_REFRESH_INTERVAL) {
      nameTimer.current = 0
      const names = Array.from({ length: POOL_SIZE }, (_, i) => {
        const p = ids[i] ? remotePlayers.get(ids[i]) : undefined
        return p?.name ?? ''
      })
      if (names.some((n, i) => n !== slotNames[i])) setSlotNames(names)
    }

    for (let i = 0; i < POOL_SIZE; i++) {
      const refs = pool.current[i]
      if (!refs) continue
      const id = ids[i]
      const p = id ? remotePlayers.get(id) : undefined
      if (!p) {
        refs.group.visible = false
        continue
      }

      p.renderPos.lerp(p.targetPos, 1 - Math.pow(0.001, dt))
      p.renderYaw = THREE.MathUtils.lerp(p.renderYaw, p.targetYaw, 1 - Math.pow(0.001, dt))
      p.renderPitch = THREE.MathUtils.lerp(p.renderPitch, p.targetPitch, 1 - Math.pow(0.001, dt))
      if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt * 4)
      if (p.burstFlash > 0) p.burstFlash = Math.max(0, p.burstFlash - dt * 6)

      refs.group.visible = p.alive
      refs.group.position.copy(p.renderPos)
      refs.group.rotation.y = p.renderYaw

      // Aim the gun arm up/down with the player's pitch (mild clamp so it reads as a rifle tilt)
      refs.gunPivot.rotation.x = THREE.MathUtils.clamp(-p.renderPitch, -0.9, 0.9)

      const invuln = p.invulnUntil > performance.now()
      const isBeamClass = p.classId === 'A'
      refs.beamGunGroup.visible = isBeamClass
      refs.burstGunGroup.visible = !isBeamClass

      const color = CLASSES[p.classId].accentColor
      refs.bodyMat.color.set(invuln ? '#66e0ff' : color)
      const glowIntensity = p.firing || p.burstFlash > 0 ? 2.2 : 0.6
      const activeGlowMat = isBeamClass ? refs.beamGlowMat : refs.burstGlowMat
      activeGlowMat.emissiveIntensity = glowIntensity

      // Beam (continuous, Class A) or tracer flash (Class B) — mutually exclusive per slot.
      const showBeam = p.firing || p.burstFlash > 0
      refs.beam.visible = showBeam
      if (showBeam) {
        refs.gunPivot.getWorldPosition(_tipWorld)
        if (p.burstFlash > 0) {
          _dir.copy(p.lastShotDir)
        } else {
          aimDirection(_dir, p.renderYaw, p.renderPitch)
        }
        _end.copy(_tipWorld).addScaledVector(_dir, BEAM_RANGE)
        _mid.addVectors(_tipWorld, _end).multiplyScalar(0.5)
        refs.beam.position.copy(_mid)
        refs.beam.scale.set(1, BEAM_RANGE, 1)
        refs.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _dir)
        refs.beamMat.opacity = p.burstFlash > 0 ? Math.min(1, p.burstFlash * 6) * 0.8 : 0.55
      }
    }
  })

  return (
    <group>
      {slots.map((i) => (
        <RemoteSlot
          key={i}
          name={slotNames[i]}
          register={(r) => {
            pool.current[i] = r
          }}
        />
      ))}
    </group>
  )
}
