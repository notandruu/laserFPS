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
import {
  ARENA_RADIUS,
  PLAYER_HEIGHT,
  PLAYER_POS,
  enemyField,
} from '@/lib/laser/enemies'
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
const _move = new THREE.Vector3()
const _moveForward = new THREE.Vector3()
const _moveRight = new THREE.Vector3()

const LOOK_SENSITIVITY = 0.0024
const WALK_SPEED = 6.4
const SPRINT_SPEED = 9.2

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
  const keys = useRef({
    forward: false,
    back: false,
    left: false,
    right: false,
    sprint: false,
  })

  useEffect(() => {
    const setKey = (code: string, down: boolean) => {
      if (code === 'KeyW') keys.current.forward = down
      else if (code === 'KeyS') keys.current.back = down
      else if (code === 'KeyA') keys.current.left = down
      else if (code === 'KeyD') keys.current.right = down
      else if (code === 'ShiftLeft' || code === 'ShiftRight') {
        keys.current.sprint = down
      } else {
        return false
      }
      return true
    }

    const onDown = (e: KeyboardEvent) => {
      if (modeRef.current !== 'playing') return
      if (setKey(e.code, true)) e.preventDefault()
    }
    const onUp = (e: KeyboardEvent) => {
      if (setKey(e.code, false)) e.preventDefault()
    }
    const clear = () => {
      keys.current.forward = false
      keys.current.back = false
      keys.current.left = false
      keys.current.right = false
      keys.current.sprint = false
    }

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', clear)
    }
  }, [])

  // Pointer down/up toggles the laser (only while playing)
  useEffect(() => {
    const el = gl.domElement

    const requestLock = () => {
      if (document.pointerLockElement === el) return
      if (useGameStore.getState().mode !== 'playing') return
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
      if (useGameStore.getState().mode !== 'playing') return
      if (document.pointerLockElement === el) return
      const lock = el.requestPointerLock()
      if (lock instanceof Promise) lock.catch(() => undefined)
    }

    const syncLockState = () => {
      pointerLocked.current = document.pointerLockElement === el
      if (pointerLocked.current) {
        window.dispatchEvent(new Event('laser-look-ready'))
      } else if (laserState.firing) {
        laserState.firing = false
        setFiring(false)
        laserAudio.stop()
      }
    }

    const onMove = (e: MouseEvent) => {
      if (modeRef.current !== 'playing') return
      if (!pointerLocked.current) return

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
    window.addEventListener('laser-request-pointer-lock', requestLock)
    document.addEventListener('pointerlockchange', syncLockState)
    document.addEventListener('mousemove', onMove)
    return () => {
      el.removeEventListener('click', requestLock)
      window.removeEventListener('laser-request-pointer-lock', requestLock)
      document.removeEventListener('pointerlockchange', syncLockState)
      document.removeEventListener('mousemove', onMove)
    }
  }, [gl, setFiring])

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.05)
    const playing = modeRef.current === 'playing'

    _move.set(0, 0, 0)
    if (playing) {
      _moveForward.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current))
      _moveRight.set(Math.cos(yaw.current), 0, -Math.sin(yaw.current))

      if (keys.current.forward) _move.add(_moveForward)
      if (keys.current.back) _move.sub(_moveForward)
      if (keys.current.right) _move.add(_moveRight)
      if (keys.current.left) _move.sub(_moveRight)

      if (_move.lengthSq() > 0) {
        _move.normalize().multiplyScalar(
          (keys.current.sprint ? SPRINT_SPEED : WALK_SPEED) * dt
        )
        PLAYER_POS.add(_move)
        PLAYER_POS.y = PLAYER_HEIGHT
        const flatDist = Math.hypot(PLAYER_POS.x, PLAYER_POS.z)
        if (flatDist > ARENA_RADIUS) {
          const scale = ARENA_RADIUS / flatDist
          PLAYER_POS.x *= scale
          PLAYER_POS.z *= scale
        }
      }
    }
    camera.position.copy(PLAYER_POS)

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
    const contact = enemyField.update(dt, PLAYER_POS)

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
        enemyField.spawnWave(nextWave, PLAYER_POS)
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
      PLAYER_POS.set(0, PLAYER_HEIGHT, 0)
      keys.current.forward = false
      keys.current.back = false
      keys.current.left = false
      keys.current.right = false
      keys.current.sprint = false
      spawnedForMode.current = false
      waveTimer.current = 0
      pointerLocked.current = false
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

function Arena() {
  const markers = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2
        const radius = ARENA_RADIUS - 4
        return {
          id: i,
          angle,
          x: Math.cos(angle) * radius,
          z: Math.sin(angle) * radius,
          tall: i % 3 === 0,
        }
      }),
    []
  )

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]}>
        <planeGeometry args={[ARENA_RADIUS * 2.6, ARENA_RADIUS * 2.6]} />
        <meshStandardMaterial color="#070707" roughness={0.85} metalness={0.1} />
      </mesh>

      <gridHelper
        args={[ARENA_RADIUS * 2, 28, '#5a5a5a', '#171717']}
        position={[0, FLOOR_Y + 0.012, 0]}
      />

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, FLOOR_Y + 0.04, 0]}>
        <torusGeometry args={[ARENA_RADIUS, 0.035, 8, 160]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.26} />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 1.25, 0]}>
        <torusGeometry args={[ARENA_RADIUS - 1.4, 0.025, 8, 160]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.16} />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 3.6, 0]}>
        <torusGeometry args={[ARENA_RADIUS - 2.8, 0.025, 8, 160]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} />
      </mesh>

      {markers.map((marker) => (
        <group
          key={marker.id}
          position={[marker.x, FLOOR_Y + 1.25, marker.z]}
          rotation={[0, -marker.angle, 0]}
        >
          <mesh>
            <boxGeometry args={[0.22, marker.tall ? 5.4 : 3.1, 0.22]} />
            <meshStandardMaterial
              color="#151515"
              emissive="#ffffff"
              emissiveIntensity={marker.tall ? 0.7 : 0.34}
              roughness={0.5}
              metalness={0.4}
            />
          </mesh>
          <mesh position={[0, 0.35, -0.02]}>
            <boxGeometry args={[1.4, 0.09, 0.05]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.38} />
          </mesh>
          <mesh position={[0, 1.25, -0.02]}>
            <boxGeometry args={[0.9, 0.06, 0.05]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.26} />
          </mesh>
          <mesh position={[0, marker.tall ? 2.85 : 1.7, 0]}>
            <sphereGeometry args={[marker.tall ? 0.32 : 0.22, 14, 14]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
          {marker.tall && (
            <pointLight
              position={[0, 2.9, 0]}
              intensity={1.1}
              distance={8}
              decay={2}
              color="#ffffff"
            />
          )}
        </group>
      ))}
    </group>
  )
}

export function LaserScene() {
  const dpr = useMemo<[number, number]>(() => [1, 2], [])

  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, PLAYER_HEIGHT, 0], fov: 65, near: 0.05, far: 120 }}
      gl={{ antialias: true }}
      className="touch-none"
    >
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 18, 52]} />

      <ambientLight intensity={0.28} />
      <directionalLight position={[2, 6, 5]} intensity={1.1} color="#dfe6ee" />
      <pointLight position={[0, 5, 0]} intensity={3} distance={18} decay={2} color="#cfd6de" />

      <Controller />
      <Enemies />
      <Arena />
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
