'use client'

import { useCallback, useRef } from 'react'
import * as THREE from 'three'
import { laserAudio } from '@/lib/laser/audio'
import { laserState } from '@/lib/laser/store'
import { PLAYER_POS } from '@/lib/laser/world'
import { DashSlide } from '@/lib/laser/dash-slide'
import { CLASS_A } from './classes'
import { damagePlayerAt } from './pvp-hit'
import { broadcastHit } from './net-sync'
import type { ClassDeps, ClassRuntime } from './class-types'

const _forward = new THREE.Vector3()
const _origin = new THREE.Vector3()
const _fallback = new THREE.Vector3()
const _move = new THREE.Vector3()
/** How often accumulated beam damage is flushed to the network while held on a target */
const BEAM_SEND_INTERVAL = 0.1

/** Class A "Striker": continuous beam + dash. Same feel as solo mode, retargeted at players. */
export function useClassA(deps: ClassDeps): ClassRuntime {
  const abilityCooldown = useRef(0)
  const beamTarget = useRef<string | null>(null)
  const beamAccum = useRef(0)
  const beamSendTimer = useRef(0)
  const dashSlide = useRef(new DashSlide())

  const flushBeam = useCallback(() => {
    if (beamTarget.current && beamAccum.current > 0) {
      const point = new THREE.Vector3(
        laserState.hitPoint.x,
        laserState.hitPoint.y,
        laserState.hitPoint.z
      )
      broadcastHit(beamTarget.current, beamAccum.current, point, 'beam')
    }
    beamTarget.current = null
    beamAccum.current = 0
    beamSendTimer.current = 0
  }, [])

  const fireDown = useCallback(() => {
    if (!deps.isPlaying()) return
    laserState.firing = true
    laserAudio.start()
  }, [deps])

  const fireUp = useCallback(() => {
    laserState.firing = false
    laserAudio.stop()
    flushBeam()
  }, [flushBeam])

  const useAbility = useCallback(() => {
    if (!deps.isPlaying()) return
    if (abilityCooldown.current > 0) return
    deps.movement.computeMoveVector(_move)
    if (_move.lengthSq() === 0) {
      _move.set(-Math.sin(deps.movement.yaw.current), 0, -Math.cos(deps.movement.yaw.current))
    }
    _move.normalize()

    laserState.abilityFrom = { x: PLAYER_POS.x, y: PLAYER_POS.y, z: PLAYER_POS.z }
    laserState.abilityTo = {
      x: PLAYER_POS.x + _move.x * CLASS_A.dashDistance,
      y: PLAYER_POS.y,
      z: PLAYER_POS.z + _move.z * CLASS_A.dashDistance,
    }
    laserState.abilityKind = 'dash'
    laserState.abilityAt = performance.now()

    dashSlide.current.start(_move, CLASS_A.dashDistance)
    abilityCooldown.current = CLASS_A.dashCooldown
    deps.setAbilityCooldown(CLASS_A.dashCooldown)
    laserAudio.blip(35)
  }, [deps])

  const tick = useCallback(
    (dt: number) => {
      if (abilityCooldown.current > 0) {
        abilityCooldown.current = Math.max(0, abilityCooldown.current - dt)
        deps.setAbilityCooldown(abilityCooldown.current)
      }
      if (dashSlide.current.active) {
        dashSlide.current.advance(dt, PLAYER_POS)
        deps.clampToArena()
      }

      deps.camera.getWorldDirection(_forward)
      _origin.copy(deps.camera.position)
      _fallback.copy(_origin).addScaledVector(_forward, 40)

      if (deps.isPlaying() && laserState.firing) {
        const res = damagePlayerAt(_origin, _forward, deps.selfId())
        if (res) {
          laserState.hitPoint = { x: res.point.x, y: res.point.y, z: res.point.z }
          laserState.hasHit = true
          if (beamTarget.current !== res.victimId) {
            flushBeam()
            beamTarget.current = res.victimId
          }
          beamAccum.current += CLASS_A.beamDps * dt
          beamSendTimer.current += dt
          if (beamSendTimer.current >= BEAM_SEND_INTERVAL) flushBeam()
        } else {
          laserState.hitPoint = { x: _fallback.x, y: _fallback.y, z: _fallback.z }
          laserState.hasHit = false
          flushBeam()
        }
      } else {
        laserState.hitPoint = { x: _fallback.x, y: _fallback.y, z: _fallback.z }
        laserState.hasHit = false
      }
    },
    [deps, flushBeam]
  )

  return { fireDown, fireUp, useAbility, tick }
}
