'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Bloom,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { laserAudio } from '@/lib/laser/audio'
import { enemyField } from '@/lib/laser/enemies'
import { ARENA_RADIUS, PLAYER_HEIGHT, PLAYER_POS } from '@/lib/laser/world'
import { usePlayerMovement } from '@/lib/laser/movement'
import { DashSlide } from '@/lib/laser/dash-slide'
import { laserState, useGameStore, type WeaponId } from '@/lib/laser/store'
import {
  BEAM_DPS,
  DASH_COOLDOWN,
  DASH_DISTANCE,
  PULSE_COOLDOWN,
  PULSE_DAMAGE,
  SPRINT_SPEED,
  WALK_SPEED,
} from '@/lib/laser/weapon-constants'
import { AbilityFx } from './ability-fx'
import { Enemies } from './enemies'
import { HandLaser } from './hand-laser'
import { Sparks } from './sparks'

const FLOOR_Y = -2
/** Delay between clearing a wave and the next spawning */
const WAVE_DELAY = 1.4

const _forward = new THREE.Vector3()
const _origin = new THREE.Vector3()
const _fallback = new THREE.Vector3()
const _move = new THREE.Vector3()

/**
 * Per-frame controller: mouse-look aiming, continuous-beam damage on drones,
 * enemy advancement + contact damage, and endless wave escalation.
 */
function Controller() {
  const { camera, gl } = useThree()
  const mode = useGameStore((s) => s.mode)
  const weapon = useGameStore((s) => s.weapon)
  const setFiring = useGameStore((s) => s.setFiring)
  const setWeapon = useGameStore((s) => s.setWeapon)
  const setPulseCooldown = useGameStore((s) => s.setPulseCooldown)
  const setDashCooldown = useGameStore((s) => s.setDashCooldown)
  const modeRef = useRef(mode)
  const weaponRef = useRef<WeaponId>(weapon)

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    weaponRef.current = weapon
    if (weapon !== 'beam' && laserState.firing) {
      laserState.firing = false
      setFiring(false)
      laserAudio.stop()
    }
  }, [weapon, setFiring])

  const waveTimer = useRef(0)
  const spawnedForMode = useRef(false)
  const pulseCooldown = useRef(0)
  const dashCooldown = useRef(0)
  const lastPulseDisplay = useRef(0)
  const lastDashDisplay = useRef(0)
  const dashSlide = useRef(new DashSlide())

  const stopFiring = useCallback(() => {
    if (!laserState.firing) return
    laserState.firing = false
    setFiring(false)
    laserAudio.stop()
  }, [setFiring])

  const isPlaying = useCallback(() => modeRef.current === 'playing', [])
  const movement = usePlayerMovement(gl.domElement, isPlaying, stopFiring)

  const publishPulseCooldown = useCallback(
    (value: number) => {
      const display = Math.max(0, Number(value.toFixed(2)))
      if (Math.abs(display - lastPulseDisplay.current) < 0.03 && display !== 0) {
        return
      }
      lastPulseDisplay.current = display
      setPulseCooldown(display)
    },
    [setPulseCooldown]
  )

  const publishDashCooldown = useCallback(
    (value: number) => {
      const display = Math.max(0, Number(value.toFixed(2)))
      if (Math.abs(display - lastDashDisplay.current) < 0.03 && display !== 0) {
        return
      }
      lastDashDisplay.current = display
      setDashCooldown(display)
    },
    [setDashCooldown]
  )

  const awardKill = useCallback((scoreValue: number) => {
    const s = useGameStore.getState()
    s.addKill()
    s.addScore(scoreValue)
    laserAudio.blip(90)
  }, [])

  const clampPlayerToArena = useCallback(() => {
    PLAYER_POS.y = PLAYER_HEIGHT
    const flatDist = Math.hypot(PLAYER_POS.x, PLAYER_POS.z)
    if (flatDist > ARENA_RADIUS) {
      const scale = ARENA_RADIUS / flatDist
      PLAYER_POS.x *= scale
      PLAYER_POS.z *= scale
    }
  }, [])

  const performDash = useCallback(() => {
    if (modeRef.current !== 'playing') return
    if (dashCooldown.current > 0) return

    movement.computeMoveVector(_move)
    if (_move.lengthSq() === 0) {
      _move.set(-Math.sin(movement.yaw.current), 0, -Math.cos(movement.yaw.current))
    }
    _move.normalize()

    laserState.abilityFrom = { x: PLAYER_POS.x, y: PLAYER_POS.y, z: PLAYER_POS.z }
    laserState.abilityTo = {
      x: PLAYER_POS.x + _move.x * DASH_DISTANCE,
      y: PLAYER_POS.y,
      z: PLAYER_POS.z + _move.z * DASH_DISTANCE,
    }
    laserState.abilityKind = 'dash'
    laserState.abilityAt = performance.now()

    dashSlide.current.start(_move, DASH_DISTANCE)
    dashCooldown.current = DASH_COOLDOWN
    publishDashCooldown(DASH_COOLDOWN)
    laserAudio.blip(35)
  }, [movement, publishDashCooldown])

  const firePulse = useCallback(() => {
    if (modeRef.current !== 'playing') return
    if (pulseCooldown.current > 0) return

    camera.getWorldDirection(_forward)
    _origin.copy(camera.position)
    _fallback.copy(_origin).addScaledVector(_forward, 42)

    const res = enemyField.damageAt(_origin, _forward, PULSE_DAMAGE)
    if (res) {
      laserState.hitPoint = {
        x: res.point.x,
        y: res.point.y,
        z: res.point.z,
      }
      laserState.hasHit = true
      if (res.killed) awardKill(res.scoreValue)
      else laserAudio.blip(70)
    } else {
      laserState.hitPoint = {
        x: _fallback.x,
        y: _fallback.y,
        z: _fallback.z,
      }
      laserState.hasHit = false
      laserAudio.blip(35)
    }

    laserState.pulseFlash = 0.12
    pulseCooldown.current = PULSE_COOLDOWN
    publishPulseCooldown(PULSE_COOLDOWN)
  }, [awardKill, camera, publishPulseCooldown])

  // Mode-specific keys: weapon swap + dash. WASD/sprint are handled by usePlayerMovement.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (modeRef.current !== 'playing') return
      if (e.code === 'Digit1') {
        setWeapon('beam')
        e.preventDefault()
      } else if (e.code === 'Digit2') {
        setWeapon('pulse')
        e.preventDefault()
      } else if (e.code === 'Space') {
        performDash()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onDown)
    return () => window.removeEventListener('keydown', onDown)
  }, [performDash, setWeapon])

  // Pointer down/up toggles the laser (only while playing)
  useEffect(() => {
    const el = gl.domElement

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (modeRef.current !== 'playing') return
      movement.requestLock()
      if (weaponRef.current === 'pulse') {
        firePulse()
        return
      }
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
  }, [firePulse, gl, movement, setFiring])

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.05)
    const playing = modeRef.current === 'playing'

    if (laserState.pulseFlash > 0) {
      laserState.pulseFlash = Math.max(0, laserState.pulseFlash - dt)
    }
    if (pulseCooldown.current > 0) {
      pulseCooldown.current = Math.max(0, pulseCooldown.current - dt)
      publishPulseCooldown(pulseCooldown.current)
    }
    if (dashCooldown.current > 0) {
      dashCooldown.current = Math.max(0, dashCooldown.current - dt)
      publishDashCooldown(dashCooldown.current)
    }
    if (dashSlide.current.active) {
      dashSlide.current.advance(dt, PLAYER_POS)
      clampPlayerToArena()
    }

    _move.set(0, 0, 0)
    if (playing) {
      movement.computeMoveVector(_move)
      if (_move.lengthSq() > 0) {
        _move.normalize().multiplyScalar(
          (movement.keys.current.sprint ? SPRINT_SPEED : WALK_SPEED) * dt
        )
        PLAYER_POS.add(_move)
        clampPlayerToArena()
      }
    }
    camera.position.copy(PLAYER_POS)

    // ----- Mouse-look: accumulated deltas -> unbounded yaw, clamped pitch -----
    movement.applyLook(camera, dt)

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
          awardKill(res.scoreValue)
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
      movement.clearKeys()
      spawnedForMode.current = false
      waveTimer.current = 0
      pulseCooldown.current = 0
      dashCooldown.current = 0
      lastPulseDisplay.current = 0
      lastDashDisplay.current = 0
      publishPulseCooldown(0)
      publishDashCooldown(0)
      laserState.pulseFlash = 0
      // Recenter the view for the new run.
      movement.reset()
    } else if (typeof document !== 'undefined' && document.pointerLockElement) {
      // Release the cursor so menu / game-over buttons are clickable.
      document.exitPointerLock()
    }
  }, [mode, movement, publishDashCooldown, publishPulseCooldown])

  return null
}

export function Arena() {
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
  const weapon = useGameStore((s) => s.weapon)

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
      <HandLaser kind={weapon === 'beam' ? 'beam' : 'burst'} />
      <Sparks />
      <AbilityFx />

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
