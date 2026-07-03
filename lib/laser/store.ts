'use client'

import { create } from 'zustand'

export type GameMode = 'menu' | 'playing' | 'gameover'
export type WeaponId = 'beam' | 'pulse'

export const MAX_HEALTH = 100

interface GameState {
  mode: GameMode
  firing: boolean
  health: number
  score: number
  wave: number
  kills: number
  weapon: WeaponId
  pulseCooldown: number
  dashCooldown: number
  highScore: number
  /** Increments whenever the player takes contact damage, drives the HUD damage flash */
  damageTick: number
  setMode: (mode: GameMode) => void
  setFiring: (firing: boolean) => void
  setHealth: (health: number) => void
  takeDamage: (amount: number) => void
  addScore: (amount: number) => void
  setWave: (wave: number) => void
  addKill: () => void
  setWeapon: (weapon: WeaponId) => void
  setPulseCooldown: (cooldown: number) => void
  setDashCooldown: (cooldown: number) => void
  loadHighScore: () => void
  startGame: () => void
  endGame: () => void
}

function readHighScore() {
  if (typeof window === 'undefined') return 0
  const raw = window.localStorage.getItem('laser-strike-highscore')
  return raw ? Number.parseInt(raw, 10) || 0 : 0
}

export const useGameStore = create<GameState>((set, get) => ({
  mode: 'menu',
  firing: false,
  health: MAX_HEALTH,
  score: 0,
  wave: 1,
  kills: 0,
  weapon: 'beam',
  pulseCooldown: 0,
  dashCooldown: 0,
  highScore: 0,
  damageTick: 0,
  setMode: (mode) => set({ mode }),
  setFiring: (firing) => set({ firing }),
  setHealth: (health) => set({ health }),
  takeDamage: (amount) =>
    set((s) => ({
      health: Math.max(0, s.health - amount),
      damageTick: s.damageTick + 1,
    })),
  addScore: (amount) => set((s) => ({ score: s.score + amount })),
  setWave: (wave) => set({ wave }),
  addKill: () => set((s) => ({ kills: s.kills + 1 })),
  setWeapon: (weapon) => set({ weapon }),
  setPulseCooldown: (pulseCooldown) => set({ pulseCooldown }),
  setDashCooldown: (dashCooldown) => set({ dashCooldown }),
  loadHighScore: () => set({ highScore: readHighScore() }),
  startGame: () =>
    set({
      mode: 'playing',
      health: MAX_HEALTH,
      score: 0,
      wave: 1,
      kills: 0,
      weapon: 'beam',
      pulseCooldown: 0,
      dashCooldown: 0,
      firing: false,
    }),
  endGame: () => {
    const { score, highScore } = get()
    const nextHigh = Math.max(score, highScore)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('laser-strike-highscore', String(nextHigh))
    }
    set({ mode: 'gameover', firing: false, highScore: nextHigh })
  },
}))

/**
 * Mutable per-frame laser state shared between the 3D scene components.
 * Kept outside React state to avoid re-renders at 60fps.
 */
export const laserState = {
  /** Current beam impact point in world space (enemy hit or far fallback) */
  hitPoint: { x: 0, y: 1.6, z: -8 },
  /** Whether the beam is currently landing on something worth showing sparks for */
  hasHit: false,
  firing: false,
  /** Smoothed pointer for hand sway */
  pointer: { x: 0, y: 0 },
  /** Mouse-look camera orientation (radians) */
  aimYaw: 0,
  aimPitch: 0,
  /** Short-lived visual flash for single-shot weapons */
  pulseFlash: 0,
}
