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
import { usePlayerMovement } from '@/lib/laser/movement'
import { Arena } from '@/components/laser/scene'
import { HandLaser } from '@/components/laser/hand-laser'
import { CLASSES } from '@/lib/multiplayer/classes'
import { Sparks } from '@/components/laser/sparks'
import { laserState } from '@/lib/laser/store'
import { ARENA_RADIUS, PLAYER_HEIGHT, PLAYER_POS } from '@/lib/laser/world'
import { useClassA } from '@/lib/multiplayer/class-a'
import { useClassB } from '@/lib/multiplayer/class-b'
import { useMultiplayerStore } from '@/lib/multiplayer/mp-store'
import { sendTransform } from '@/lib/multiplayer/net-sync'
import { RemotePlayers } from './remote-players'

const _move = new THREE.Vector3()

function Controller() {
  const { camera, gl } = useThree()
  const matchPhase = useMultiplayerStore((s) => s.matchPhase)
  const myClass = useMultiplayerStore((s) => s.myClass)
  const alive = useMultiplayerStore((s) => s.alive)
  const setWeaponCooldown = useMultiplayerStore((s) => s.setWeaponCooldown)
  const setAbilityCooldown = useMultiplayerStore((s) => s.setAbilityCooldown)

  const phaseRef = useRef(matchPhase)
  const aliveRef = useRef(alive)
  const classRef = useRef(myClass)
  useEffect(() => {
    phaseRef.current = matchPhase
  }, [matchPhase])
  useEffect(() => {
    aliveRef.current = alive
  }, [alive])
  useEffect(() => {
    classRef.current = myClass
  }, [myClass])

  const isPlaying = useCallback(() => phaseRef.current === 'active' && aliveRef.current, [])
  const selfId = useCallback(() => useMultiplayerStore.getState().myPlayerId, [])

  const stopFiring = useCallback(() => {
    if (laserState.firing) {
      laserState.firing = false
      laserAudio.stop()
    }
  }, [])

  const movement = usePlayerMovement(gl.domElement, isPlaying, stopFiring)

  const clampPlayerToArena = useCallback(() => {
    PLAYER_POS.y = PLAYER_HEIGHT
    const flatDist = Math.hypot(PLAYER_POS.x, PLAYER_POS.z)
    if (flatDist > ARENA_RADIUS) {
      const scale = ARENA_RADIUS / flatDist
      PLAYER_POS.x *= scale
      PLAYER_POS.z *= scale
    }
  }, [])

  const classDeps = useMemo(
    () => ({
      camera,
      selfId,
      isPlaying,
      setWeaponCooldown,
      setAbilityCooldown,
      movement,
      clampToArena: clampPlayerToArena,
    }),
    [camera, selfId, isPlaying, setWeaponCooldown, setAbilityCooldown, movement, clampPlayerToArena]
  )

  const classA = useClassA(classDeps)
  const classB = useClassB(classDeps)
  const activeClassRef = useRef(classA)
  useEffect(() => {
    activeClassRef.current = myClass === 'A' ? classA : classB
  }, [myClass, classA, classB])

  // Fire input
  useEffect(() => {
    const el = gl.domElement
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (!isPlaying()) return
      movement.requestLock()
      activeClassRef.current.fireDown()
    }
    const up = () => {
      activeClassRef.current.fireUp()
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
  }, [gl, isPlaying, movement])

  // Ability (dash / blink) on Space
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      if (!isPlaying()) return
      activeClassRef.current.useAbility()
      e.preventDefault()
    }
    window.addEventListener('keydown', onDown)
    return () => window.removeEventListener('keydown', onDown)
  }, [isPlaying])

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.05)
    const playing = phaseRef.current === 'active'

    _move.set(0, 0, 0)
    if (playing && aliveRef.current) {
      movement.computeMoveVector(_move)
      if (_move.lengthSq() > 0) {
        _move.normalize().multiplyScalar(6.4 * dt * (movement.keys.current.sprint ? 1.44 : 1))
        PLAYER_POS.add(_move)
        clampPlayerToArena()
      }
    }
    camera.position.copy(PLAYER_POS)
    movement.applyLook(camera, dt)

    if (playing && aliveRef.current) {
      activeClassRef.current.tick(dt)
      sendTransform(dt, PLAYER_POS, movement.yaw.current, movement.pitch.current, laserState.firing)
    } else if (!aliveRef.current) {
      laserState.firing = false
    }
  })

  return null
}

export function MultiplayerScene() {
  const dpr = useMemo<[number, number]>(() => [1, 2], [])
  const myClass = useMultiplayerStore((s) => s.myClass)
  const classConfig = CLASSES[myClass]

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
      <RemotePlayers />
      <Arena />
      <HandLaser
        kind={myClass === 'A' ? 'beam' : 'burst'}
        accentColor={classConfig.accentColor}
      />
      <Sparks />

      <EffectComposer>
        <Bloom intensity={0.9} luminanceThreshold={0.75} luminanceSmoothing={0.2} mipmapBlur />
        <Noise opacity={0.035} />
        <Vignette eskil={false} offset={0.18} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  )
}
