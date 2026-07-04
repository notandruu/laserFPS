'use client'

import { useCallback, useRef } from 'react'
import * as THREE from 'three'
import { laserAudio } from '@/lib/laser/audio'
import { laserState } from '@/lib/laser/store'
import { PLAYER_POS } from '@/lib/laser/world'
import { CLASS_B } from './classes'
import { damagePlayerAt } from './pvp-hit'
import { broadcastBlink, broadcastHit, broadcastShot } from './net-sync'
import { myNetState } from './net-state'
import type { ClassDeps, ClassRuntime } from './class-types'

const _forward = new THREE.Vector3()
const _origin = new THREE.Vector3()
const _fallback = new THREE.Vector3()
const _move = new THREE.Vector3()

/** Class B "Phantom": 3-round hitscan burst + instant blink with i-frames. */
export function useClassB(deps: ClassDeps): ClassRuntime {
  const weaponCooldown = useRef(0)
  const abilityCooldown = useRef(0)
  const shotsRemaining = useRef(0)
  const nextShotTimer = useRef(0)

  const fireOneShot = useCallback(() => {
    deps.camera.getWorldDirection(_forward)
    _origin.copy(deps.camera.position)
    _fallback.copy(_origin).addScaledVector(_forward, 40)

    const res = damagePlayerAt(_origin, _forward, deps.selfId())
    laserState.pulseFlash = 0.1
    broadcastShot(_origin, _forward, 'burst')
    if (res) {
      laserState.hitPoint = { x: res.point.x, y: res.point.y, z: res.point.z }
      laserState.hasHit = true
      broadcastHit(res.victimId, CLASS_B.burstShotDamage, res.point, 'burst')
      laserAudio.blip(70)
    } else {
      laserState.hitPoint = { x: _fallback.x, y: _fallback.y, z: _fallback.z }
      laserState.hasHit = false
      laserAudio.blip(35)
    }
  }, [deps])

  const fireDown = useCallback(() => {
    if (!deps.isPlaying()) return
    if (weaponCooldown.current > 0) return
    weaponCooldown.current = CLASS_B.burstCooldown
    deps.setWeaponCooldown(CLASS_B.burstCooldown)
    shotsRemaining.current = CLASS_B.burstShotCount
    nextShotTimer.current = 0
  }, [deps])

  const fireUp = useCallback(() => {
    // Burst completes on its own once triggered; nothing to do on release.
  }, [])

  const useAbility = useCallback(() => {
    if (!deps.isPlaying()) return
    if (abilityCooldown.current > 0) return

    deps.movement.computeMoveVector(_move)
    if (_move.lengthSq() === 0) {
      _move.set(-Math.sin(deps.movement.yaw.current), 0, -Math.cos(deps.movement.yaw.current))
    }
    _move.normalize()

    laserState.abilityFrom = { x: PLAYER_POS.x, y: PLAYER_POS.y, z: PLAYER_POS.z }
    _move.multiplyScalar(CLASS_B.blinkDistance)
    PLAYER_POS.add(_move)
    deps.clampToArena()
    laserState.abilityTo = { x: PLAYER_POS.x, y: PLAYER_POS.y, z: PLAYER_POS.z }
    laserState.abilityKind = 'blink'
    laserState.abilityAt = performance.now()

    const invulnUntil = performance.now() + CLASS_B.blinkInvulnSeconds * 1000
    myNetState.invulnUntil = invulnUntil
    broadcastBlink(PLAYER_POS, invulnUntil)

    abilityCooldown.current = CLASS_B.blinkCooldown
    deps.setAbilityCooldown(CLASS_B.blinkCooldown)
    laserAudio.blip(35)
  }, [deps])

  const tick = useCallback(
    (dt: number) => {
      if (weaponCooldown.current > 0) {
        weaponCooldown.current = Math.max(0, weaponCooldown.current - dt)
        deps.setWeaponCooldown(weaponCooldown.current)
      }
      if (abilityCooldown.current > 0) {
        abilityCooldown.current = Math.max(0, abilityCooldown.current - dt)
        deps.setAbilityCooldown(abilityCooldown.current)
      }

      if (shotsRemaining.current > 0) {
        nextShotTimer.current -= dt
        if (nextShotTimer.current <= 0) {
          fireOneShot()
          shotsRemaining.current -= 1
          nextShotTimer.current = CLASS_B.burstShotInterval
        }
      } else if (!laserState.firing) {
        // Idle beam-fallback visual (no beam for this class): keep the aim point live.
        deps.camera.getWorldDirection(_forward)
        _origin.copy(deps.camera.position)
        _fallback.copy(_origin).addScaledVector(_forward, 40)
        if (laserState.pulseFlash <= 0) {
          laserState.hitPoint = { x: _fallback.x, y: _fallback.y, z: _fallback.z }
          laserState.hasHit = false
        }
      }

      if (laserState.pulseFlash > 0) {
        laserState.pulseFlash = Math.max(0, laserState.pulseFlash - dt)
      }
    },
    [deps, fireOneShot]
  )

  return { fireDown, fireUp, useAbility, tick }
}
