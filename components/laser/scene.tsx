'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Bloom,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { laserAudio } from '@/lib/laser/audio'
import { enemyField } from '@/lib/laser/enemies'
import { laserState, useGameStore } from '@/lib/laser/store'
import { Enemies } from './enemies'
import { HandLaser } from './hand-laser'
import { Sparks } from './sparks'

const FLOOR_Y = -2
/** Damage per second the beam deals while held on a drone */
const BEAM_DPS = 55
/** Delay between clearing a wave and the next spawning */
const WAVE_DELAY = 1.4

const _forward = new THREE.Vector3()
const _origin = new THREE.Vector3()
const _fallback = new THREE.Vector3()

const LOOK_SENSITIVITY = 0.0024
const EDGE_TURN_SPEED = 3.6
const EDGE_DEADZONE = 0.08

/**
 * Per-frame controller: mouse-look aiming, continuous-beam damage on drones,
 * enemy advancement + contact damage, and endless wave escalation.
 */
function Controller() {
  const { camera, gl } = useThree()
  const mode = useGameStore((s) => s.mode)
  const setFiring = useGameStore((s) => s.setFiring)
  const modeRef = useRef(mode)

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  const waveTimer = useRef(0)
  const spawnedForMode = useRef(false)

  // Accumulated mouse-look orientation (radians). Yaw is unbounded for full 360°.
  const yaw = useRef(0)
  const pitch = useRef(0)
  // Recent mouse movement, decays toward 0 to drive subtle hand sway.
  const sway = useRef({ x: 0, y: 0 })
  const pointerLocked = useRef(false)
  const fallbackLook = useRef({ active: false, x: 0, y: 0 })
  const lookReadySent = useRef(false)

  // Pointer down/up toggles the laser (only while playing)
  useEffect(() => {
    const el = gl.domElement

    const requestLock = () => {
      if (document.pointerLockElement === el) return
      const lock = el.requestPointerLock()
      if (lock instanceof Promise) lock.catch(() => undefined)
    }

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (modeRef.current !== 'playing') return
      requestLock()
      laserState.firing = true
      setFiring(true)
      laserAudio.start()
    }
    const up = () => {
      if (!laserState.firing) return
      laserState.firing = false
      setFiring(false)
      laserAudio.stop()
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('blur', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('blur', up)
      up()
    }
  }, [gl, setFiring])

  // Pointer Lock: capture the cursor when the browser allows it.
  useEffect(() => {
    const el = gl.domElement

    const requestLock = () => {
      if (modeRef.current !== 'playing') return
      if (document.pointerLockElement === el) return
      const lock = el.requestPointerLock()
      if (lock instanceof Promise) lock.catch(() => undefined)
    }

    const syncLockState = () => {
      pointerLocked.current = document.pointerLockElement === el
      if (pointerLocked.current && !lookReadySent.current) {
        lookReadySent.current = true
        window.dispatchEvent(new Event('laser-look-ready'))
      }
    }

    const onMove = (e: MouseEvent) => {
      if (modeRef.current !== 'playing') return
      if (pointerLocked.current) {
        fallbackLook.current.active = false
      } else {
        const rect = el.getBoundingClientRect()
        const inside =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom

        fallbackLook.current.active = inside
        if (inside) {
          fallbackLook.current.x =
            ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
          fallbackLook.current.y =
            ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1

          if (!lookReadySent.current) {
            lookReadySent.current = true
            window.dispatchEvent(new Event('laser-look-ready'))
          }
        }
      }

      // Yaw accumulates without clamping, so full 360 turning is allowed.
      yaw.current -= e.movementX * LOOK_SENSITIVITY
      // Pitch is clamped so the view can't flip over.
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - e.movementY * LOOK_SENSITIVITY,
        -0.9,
        0.7
      )
      sway.current.x = THREE.MathUtils.clamp(e.movementX * 0.02, -1, 1)
      sway.current.y = THREE.MathUtils.clamp(e.movementY * 0.02, -1, 1)
    }

    // Click anywhere on the canvas to (re)acquire the lock.
    el.addEventListener('click', requestLock)
    document.addEventListener('pointerlockchange', syncLockState)
    document.addEventListener('mousemove', onMove)
    return () => {
      el.removeEventListener('click', requestLock)
      document.removeEventListener('pointerlockchange', syncLockState)
      document.removeEventListener('mousemove', onMove)
    }
  }, [gl])

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.05)
    const playing = modeRef.current === 'playing'

    if (playing && !pointerLocked.current && fallbackLook.current.active) {
      const edgeX = fallbackLook.current.x
      const edgeAmount = Math.max(0, Math.abs(edgeX) - EDGE_DEADZONE)
      if (edgeAmount > 0) {
        const turn =
          Math.sign(edgeX) *
          Math.pow(edgeAmount / (1 - EDGE_DEADZONE), 1.35)
        yaw.current -= turn * EDGE_TURN_SPEED * dt
      }

      const targetPitch = THREE.MathUtils.clamp(
        -fallbackLook.current.y * 0.72,
        -0.9,
        0.7
      )
      pitch.current = THREE.MathUtils.lerp(
        pitch.current,
        targetPitch,
        Math.min(1, dt * 5)
      )
    }

    // ----- Mouse-look: accumulated deltas -> unbounded yaw, clamped pitch -----
    laserState.aimYaw = THREE.MathUtils.lerp(
      laserState.aimYaw,
      yaw.current,
      Math.min(1, dt * 18)
    )
    laserState.aimPitch = THREE.MathUtils.lerp(
      laserState.aimPitch,
      pitch.current,
      Math.min(1, dt * 18)
    )
    camera.rotation.order = 'YXZ'
    camera.rotation.y = laserState.aimYaw
    camera.rotation.x = laserState.aimPitch

    // Decay recent movement, feed it into the hand sway
    sway.current.x = THREE.MathUtils.lerp(sway.current.x, 0, Math.min(1, dt * 6))
    sway.current.y = THREE.MathUtils.lerp(sway.current.y, 0, Math.min(1, dt * 6))
    laserState.pointer.x = THREE.MathUtils.lerp(
      laserState.pointer.x,
      sway.current.x,
      Math.min(1, dt * 8)
    )
    laserState.pointer.y = THREE.MathUtils.lerp(
      laserState.pointer.y,
      sway.current.y,
      Math.min(1, dt * 8)
    )

    // ----- Beam ray from the camera center -----
    camera.getWorldDirection(_forward)
    _origin.copy(camera.position)
    _fallback.copy(_origin).addScaledVector(_forward, 40)

    if (playing && laserState.firing) {
      const res = enemyField.damageAt(_origin, _forward, BEAM_DPS * dt)
      if (res) {
        laserState.hitPoint = {
          x: res.point.x,
          y: res.point.y,
          z: res.point.z,
        }
        laserState.hasHit = true
        if (res.killed) {
          const s = useGameStore.getState()
          s.addKill()
          s.addScore(100 + (s.wave - 1) * 25)
          laserAudio.blip(90)
        }
      } else {
        laserState.hitPoint = {
          x: _fallback.x,
          y: _fallback.y,
          z: _fallback.z,
        }
        laserState.hasHit = false
      }
    } else {
      laserState.hitPoint = { x: _fallback.x, y: _fallback.y, z: _fallback.z }
      laserState.hasHit = false
    }

    if (!playing) return

    // ----- Advance enemies + contact damage -----
    const contact = enemyField.update(dt)

    if (contact > 0) {
      const s = useGameStore.getState()
      s.takeDamage(contact)
      laserAudio.hurt()
      if (useGameStore.getState().health <= 0) {
        laserState.firing = false
        setFiring(false)
        laserAudio.stop()
        s.endGame()
        return
      }
    }

    // ----- Wave management -----
    if (enemyField.aliveCount() === 0) {
      waveTimer.current -= dt
      if (waveTimer.current <= 0) {
        const s = useGameStore.getState()
        const nextWave = spawnedForMode.current ? s.wave + 1 : 1
        if (spawnedForMode.current) s.setWave(nextWave)
        enemyField.spawnWave(nextWave)
        spawnedForMode.current = true
        waveTimer.current = WAVE_DELAY
      }
    } else {
      waveTimer.current = WAVE_DELAY
    }
  })

  // Reset enemy field + wave bookkeeping whenever a new game starts
  useEffect(() => {
    if (mode === 'playing') {
      enemyField.reset()
      spawnedForMode.current = false
      waveTimer.current = 0
      fallbackLook.current.active = false
      lookReadySent.current = false
      // Recenter the view for the new run.
      yaw.current = 0
      pitch.current = 0
      laserState.aimYaw = 0
      laserState.aimPitch = 0
      window.dispatchEvent(new Event('laser-look-reset'))
    } else if (typeof document !== 'undefined' && document.pointerLockElement) {
      // Release the cursor so menu / game-over buttons are clickable.
      document.exitPointerLock()
    }
  }, [mode])

  return null
}

/** Dark concrete floor catching the laser glow */
function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, -6]}>
      <planeGeometry args={[120, 80]} />
      <meshStandardMaterial color="#070707" roughness={0.85} metalness={0.1} />
    </mesh>
  )
}

export function LaserScene() {
  const dpr = useMemo<[number, number]>(() => [1, 2], [])

  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 1.6, 6.5], fov: 65, near: 0.05, far: 120 }}
      gl={{ antialias: true }}
      className="touch-none"
    >
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 14, 40]} />

      <ambientLight intensity={0.28} />
      <directionalLight position={[2, 6, 5]} intensity={1.1} color="#dfe6ee" />
      <pointLight position={[0, 5, 4]} intensity={3} distance={16} decay={2} color="#cfd6de" />

      <Controller />
      <Enemies />
      <Floor />
      <HandLaser />
      <Sparks />

      <EffectComposer>
        <Bloom
          intensity={0.9}
          luminanceThreshold={0.75}
          luminanceSmoothing={0.2}
          mipmapBlur
        />
        <Noise opacity={0.035} />
        <Vignette eskil={false} offset={0.18} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  )
}
