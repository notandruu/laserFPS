'use client'

import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { laserState } from './store'

export const LOOK_SENSITIVITY = 0.0024

export interface MovementKeys {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  sprint: boolean
}

export interface PlayerMovement {
  yaw: MutableRefObject<number>
  pitch: MutableRefObject<number>
  keys: MutableRefObject<MovementKeys>
  isLocked: () => boolean
  requestLock: () => void
  clearKeys: () => void
  /** Direction vector (unnormalized, relative to current yaw) implied by the held movement keys */
  computeMoveVector: (out: THREE.Vector3) => THREE.Vector3
  /** Smooths accumulated yaw/pitch into laserState and applies it to the camera */
  applyLook: (camera: THREE.Camera, dt: number) => void
  /** Recenters look state for a fresh run/match */
  reset: () => void
}

/**
 * Shared WASD + mouse-look + pointer-lock controller, used by both the solo
 * Controller (scene.tsx) and the multiplayer Controller so the two modes
 * can't drift out of sync on feel.
 */
export function usePlayerMovement(
  domElement: HTMLElement,
  enabled: () => boolean,
  onUnlock?: () => void
): PlayerMovement {
  const yaw = useRef(0)
  const pitch = useRef(0)
  const sway = useRef({ x: 0, y: 0 })
  const pointerLocked = useRef(false)
  const keys = useRef<MovementKeys>({
    forward: false,
    back: false,
    left: false,
    right: false,
    sprint: false,
  })

  const requestLock = useCallback(() => {
    if (!enabled()) return
    if (document.pointerLockElement === domElement) return
    const lock = domElement.requestPointerLock()
    if (lock instanceof Promise) lock.catch(() => undefined)
  }, [domElement, enabled])

  const clearKeys = useCallback(() => {
    keys.current.forward = false
    keys.current.back = false
    keys.current.left = false
    keys.current.right = false
    keys.current.sprint = false
  }, [])

  // Keyboard: WASD + sprint only. Mode-specific keys (weapon swap, dash, etc.)
  // are handled by the caller's own listener.
  useEffect(() => {
    const setKey = (code: string, down: boolean) => {
      if (code === 'KeyW') keys.current.forward = down
      else if (code === 'KeyS') keys.current.back = down
      else if (code === 'KeyA') keys.current.left = down
      else if (code === 'KeyD') keys.current.right = down
      else if (code === 'ShiftLeft' || code === 'ShiftRight') keys.current.sprint = down
      else return false
      return true
    }
    const onDown = (e: KeyboardEvent) => {
      if (!enabled()) return
      if (setKey(e.code, true)) e.preventDefault()
    }
    const onUp = (e: KeyboardEvent) => {
      if (setKey(e.code, false)) e.preventDefault()
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', clearKeys)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', clearKeys)
    }
  }, [enabled, clearKeys])

  // Pointer lock + mouse-look
  useEffect(() => {
    const el = domElement

    const syncLockState = () => {
      pointerLocked.current = document.pointerLockElement === el
      if (pointerLocked.current) {
        window.dispatchEvent(new Event('laser-look-ready'))
      } else {
        onUnlock?.()
      }
    }

    const onMove = (e: MouseEvent) => {
      if (!enabled()) return
      if (!pointerLocked.current) return
      // Yaw accumulates without clamping, so full 360 turning is allowed.
      yaw.current -= e.movementX * LOOK_SENSITIVITY
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - e.movementY * LOOK_SENSITIVITY,
        -0.9,
        0.7
      )
      sway.current.x = THREE.MathUtils.clamp(e.movementX * 0.02, -1, 1)
      sway.current.y = THREE.MathUtils.clamp(e.movementY * 0.02, -1, 1)
    }

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
  }, [domElement, enabled, requestLock, onUnlock])

  const computeMoveVector = useCallback((out: THREE.Vector3) => {
    out.set(0, 0, 0)
    const k = keys.current
    const y = yaw.current
    if (k.forward) {
      out.x -= Math.sin(y)
      out.z -= Math.cos(y)
    }
    if (k.back) {
      out.x += Math.sin(y)
      out.z += Math.cos(y)
    }
    if (k.right) {
      out.x += Math.cos(y)
      out.z -= Math.sin(y)
    }
    if (k.left) {
      out.x -= Math.cos(y)
      out.z += Math.sin(y)
    }
    return out
  }, [])

  const applyLook = useCallback((camera: THREE.Camera, dt: number) => {
    laserState.aimYaw = THREE.MathUtils.lerp(laserState.aimYaw, yaw.current, Math.min(1, dt * 18))
    laserState.aimPitch = THREE.MathUtils.lerp(
      laserState.aimPitch,
      pitch.current,
      Math.min(1, dt * 18)
    )
    camera.rotation.order = 'YXZ'
    camera.rotation.y = laserState.aimYaw
    camera.rotation.x = laserState.aimPitch

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
  }, [])

  const reset = useCallback(() => {
    yaw.current = 0
    pitch.current = 0
    sway.current.x = 0
    sway.current.y = 0
    pointerLocked.current = false
    laserState.aimYaw = 0
    laserState.aimPitch = 0
    laserState.pointer.x = 0
    laserState.pointer.y = 0
    window.dispatchEvent(new Event('laser-look-reset'))
  }, [])

  const isLocked = useCallback(() => pointerLocked.current, [])

  return useMemo(
    () => ({
      yaw,
      pitch,
      keys,
      isLocked,
      requestLock,
      clearKeys,
      computeMoveVector,
      applyLook,
      reset,
    }),
    [isLocked, requestLock, clearKeys, computeMoveVector, applyLook, reset]
  )
}
