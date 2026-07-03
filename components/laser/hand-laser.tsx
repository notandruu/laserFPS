'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { laserState } from '@/lib/laser/store'

const _targetQuat = new THREE.Quaternion()
const _lookMatrix = new THREE.Matrix4()
const _tipWorld = new THREE.Vector3()
const _hitWorld = new THREE.Vector3()
const _mid = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

/** Radial glow texture generated at runtime for the impact flare */
function useGlowTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.25, 'rgba(255,255,255,0.6)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    const tex = new THREE.CanvasTexture(c)
    return tex
  }, [])
}

function Finger({
  position,
  rotation,
  length = 0.085,
}: {
  position: [number, number, number]
  rotation: [number, number, number]
  length?: number
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <capsuleGeometry args={[0.021, length, 6, 12]} />
        <meshStandardMaterial color="#161616" roughness={0.55} />
      </mesh>
      {/* curled second segment */}
      <mesh position={[0, length / 2 + 0.035, -0.022]} rotation={[0.9, 0, 0]}>
        <capsuleGeometry args={[0.019, 0.055, 6, 12]} />
        <meshStandardMaterial color="#141414" roughness={0.55} />
      </mesh>
    </group>
  )
}

/** Sleek matte-black laser device */
function LaserDevice({ tipRef }: { tipRef: React.RefObject<THREE.Mesh | null> }) {
  const ringRef = useRef<THREE.MeshStandardMaterial>(null)

  useFrame((state) => {
    if (!ringRef.current) return
    const firing = laserState.firing && laserState.hasHit
    const pulse = firing
      ? 2.4 + Math.sin(state.clock.elapsedTime * 30) * 0.6
      : 0.5 + Math.sin(state.clock.elapsedTime * 2) * 0.2
    ringRef.current.emissiveIntensity = pulse
  })

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
      {/* White accent ring near the tip */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.13]}>
        <cylinderGeometry args={[0.037, 0.037, 0.018, 24]} />
        <meshStandardMaterial
          ref={ringRef}
          color="#ffffff"
          emissive="#ffffff"
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
          color="#ffffff"
          emissive="#ffffff"
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

/** Stylized gloved hand gripping the device */
function Hand() {
  return (
    <group>
      {/* Palm */}
      <mesh position={[0.015, -0.075, 0.06]} rotation={[0, 0, -0.25]}>
        <sphereGeometry args={[0.075, 20, 20]} />
        <meshStandardMaterial color="#181818" roughness={0.6} />
      </mesh>
      {/* Wrist / forearm sleeve going down-right off screen */}
      <mesh position={[0.12, -0.24, 0.28]} rotation={[1.05, 0.35, -0.25]}>
        <capsuleGeometry args={[0.075, 0.42, 8, 16]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.85} />
      </mesh>
      {/* Sleeve cuff accent */}
      <mesh position={[0.065, -0.155, 0.165]} rotation={[1.05, 0.35, -0.25]}>
        <cylinderGeometry args={[0.082, 0.082, 0.03, 20]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.5} />
      </mesh>
      {/* Four fingers wrapping over the top of the barrel */}
      <Finger position={[-0.015, 0.052, -0.05]} rotation={[0, 0, 2.4]} />
      <Finger position={[-0.012, 0.054, 0.0]} rotation={[0, 0, 2.45]} />
      <Finger position={[-0.008, 0.052, 0.05]} rotation={[0, 0, 2.5]} />
      <Finger position={[-0.002, 0.048, 0.1]} rotation={[0, 0, 2.55]} length={0.07} />
      {/* Thumb pressing the side button */}
      <Finger position={[0.07, -0.02, 0.02]} rotation={[0, 0, -0.7]} length={0.07} />
    </group>
  )
}

export function HandLaser() {
  const { camera } = useThree()
  const rigRef = useRef<THREE.Group>(null)
  const aimRef = useRef<THREE.Group>(null)
  const tipRef = useRef<THREE.Mesh>(null)
  const beamCoreRef = useRef<THREE.Mesh>(null)
  const beamGlowRef = useRef<THREE.Mesh>(null)
  const flareRef = useRef<THREE.Sprite>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const glowTex = useGlowTexture()
  const recoil = useRef(0)

  useFrame((state, delta) => {
    const rig = rigRef.current
    const aim = aimRef.current
    if (!rig || !aim) return

    // Clamp delta so throttled/janky frames never cause lerp overshoot
    const dt = Math.min(delta, 0.05)

    // Rig follows the camera exactly
    rig.position.copy(camera.position)
    rig.quaternion.copy(camera.quaternion)

    // Beam shows whenever firing; impact effects only when it lands on a drone
    const firing = laserState.firing
    const impact = laserState.firing && laserState.hasHit
    recoil.current = THREE.MathUtils.lerp(recoil.current, firing ? 1 : 0, dt * 14)

    // Hand sway based on smoothed pointer + firing vibration
    const t = state.clock.elapsedTime
    const sway = laserState.pointer
    const vibX = firing ? Math.sin(t * 73) * 0.0035 * recoil.current : 0
    const vibY = firing ? Math.cos(t * 91) * 0.0035 * recoil.current : 0
    aim.position.set(
      0.42 + sway.x * 0.05 + vibX,
      -0.34 + sway.y * 0.04 + Math.sin(t * 1.6) * 0.006 + vibY,
      -0.85 + recoil.current * 0.025
    )

    // Aim the device at the wall hit point (smoothed)
    _hitWorld.set(laserState.hitPoint.x, laserState.hitPoint.y, laserState.hitPoint.z)
    const aimWorld = aim.getWorldPosition(_tipWorld.clone())
    _lookMatrix.lookAt(aimWorld, _hitWorld, _up)
    _targetQuat.setFromRotationMatrix(_lookMatrix)
    // convert world-target into rig-local
    const invRig = rig.quaternion.clone().invert()
    _targetQuat.premultiply(invRig)
    aim.quaternion.slerp(_targetQuat, Math.min(1, dt * 18))

    // ----- Beam -----
    const core = beamCoreRef.current
    const glow = beamGlowRef.current
    const flare = flareRef.current
    const light = lightRef.current
    if (!core || !glow || !flare || !light || !tipRef.current) return

    if (firing) {
      tipRef.current.getWorldPosition(_tipWorld)
      _mid.addVectors(_tipWorld, _hitWorld).multiplyScalar(0.5)
      const len = _tipWorld.distanceTo(_hitWorld)
      _dir.subVectors(_hitWorld, _tipWorld).normalize()

      for (const m of [core, glow]) {
        m.visible = true
        m.position.copy(_mid)
        m.scale.set(1, len, 1)
        m.quaternion.setFromUnitVectors(_up, _dir)
      }
      const flicker = 0.85 + Math.sin(t * 47) * 0.1 + Math.random() * 0.05
      ;(core.material as THREE.MeshBasicMaterial).opacity = flicker
      ;(glow.material as THREE.MeshBasicMaterial).opacity = 0.16 * flicker

      flare.visible = impact
      flare.position.set(_hitWorld.x, _hitWorld.y, _hitWorld.z + 0.04)
      const fs = 0.55 + Math.sin(t * 53) * 0.08 + Math.random() * 0.06
      flare.scale.set(fs, fs, 1)

      light.visible = impact
      light.position.set(_hitWorld.x, _hitWorld.y, _hitWorld.z + 0.6)
      light.intensity = 14 * flicker
    } else {
      core.visible = false
      glow.visible = false
      flare.visible = false
      light.visible = false
    }
  })

  return (
    <>
      <group ref={rigRef}>
        <group ref={aimRef}>
          <LaserDevice tipRef={tipRef} />
          <Hand />
        </group>
      </group>

      {/* Beam core */}
      <mesh ref={beamCoreRef} visible={false}>
        <cylinderGeometry args={[0.0075, 0.0035, 1, 10, 1, true]} />
        <meshBasicMaterial
          color={[6, 6, 6]}
          transparent
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Beam outer glow */}
      <mesh ref={beamGlowRef} visible={false}>
        <cylinderGeometry args={[0.035, 0.02, 1, 10, 1, true]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.15}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Impact flare */}
      <sprite ref={flareRef} visible={false}>
        <spriteMaterial
          map={glowTex}
          color={[4, 4, 4]}
          transparent
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      {/* Dynamic light cast by the impact */}
      <pointLight ref={lightRef} visible={false} color="#ffffff" distance={7} decay={2} />
    </>
  )
}
