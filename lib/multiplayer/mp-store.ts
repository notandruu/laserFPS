'use client'

import { create } from 'zustand'
import type { ClassId } from './classes'

export type MatchPhase = 'room' | 'lobby' | 'countdown' | 'active' | 'ended'

export interface ScoreboardEntry {
  playerId: string
  name: string
  classId: ClassId
  kills: number
  deaths: number
  isLocal: boolean
}

export interface LobbyPlayer {
  playerId: string
  name: string
  classId: ClassId
  ready: boolean
  isHost: boolean
}

interface MultiplayerState {
  roomCode: string | null
  myPlayerId: string
  myName: string
  myClass: ClassId
  isHost: boolean
  matchPhase: MatchPhase
  roomError: string | null
  lobbyPlayers: LobbyPlayer[]
  health: number
  maxHealth: number
  alive: boolean
  kills: number
  deaths: number
  scoreboard: ScoreboardEntry[]
  matchEndsAt: number | null
  winnerId: string | null
  weaponCooldown: number
  abilityCooldown: number
  damageTick: number

  setRoomCode: (code: string | null) => void
  setMyName: (name: string) => void
  setMyClass: (classId: ClassId) => void
  setIsHost: (isHost: boolean) => void
  setMatchPhase: (phase: MatchPhase) => void
  setRoomError: (msg: string | null) => void
  setLobbyPlayers: (players: LobbyPlayer[]) => void
  setHealth: (health: number, alive: boolean) => void
  takeDamage: (amount: number) => void
  setKillsDeaths: (kills: number, deaths: number) => void
  setScoreboard: (entries: ScoreboardEntry[]) => void
  setMatchEnd: (endsAt: number | null) => void
  setWinner: (winnerId: string | null) => void
  setWeaponCooldown: (v: number) => void
  setAbilityCooldown: (v: number) => void
  resetForMatch: () => void
  resetAll: () => void
}

const MAX_HEALTH = 100

export const useMultiplayerStore = create<MultiplayerState>((set) => ({
  roomCode: null,
  myPlayerId:
    typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Math.random()),
  myName: `PLAYER${Math.floor(1000 + Math.random() * 9000)}`,
  myClass: 'A',
  isHost: false,
  matchPhase: 'room',
  roomError: null,
  lobbyPlayers: [],
  health: MAX_HEALTH,
  maxHealth: MAX_HEALTH,
  alive: true,
  kills: 0,
  deaths: 0,
  scoreboard: [],
  matchEndsAt: null,
  winnerId: null,
  weaponCooldown: 0,
  abilityCooldown: 0,
  damageTick: 0,

  setRoomCode: (roomCode) => set({ roomCode }),
  setMyName: (myName) => set({ myName }),
  setMyClass: (myClass) => set({ myClass }),
  setIsHost: (isHost) => set({ isHost }),
  setMatchPhase: (matchPhase) => set({ matchPhase }),
  setRoomError: (roomError) => set({ roomError }),
  setLobbyPlayers: (lobbyPlayers) => set({ lobbyPlayers }),
  setHealth: (health, alive) => set({ health, alive }),
  takeDamage: (amount) =>
    set((s) => ({
      health: Math.max(0, s.health - amount),
      damageTick: s.damageTick + 1,
    })),
  setKillsDeaths: (kills, deaths) => set({ kills, deaths }),
  setScoreboard: (scoreboard) => set({ scoreboard }),
  setMatchEnd: (matchEndsAt) => set({ matchEndsAt }),
  setWinner: (winnerId) => set({ winnerId }),
  setWeaponCooldown: (weaponCooldown) => set({ weaponCooldown }),
  setAbilityCooldown: (abilityCooldown) => set({ abilityCooldown }),
  resetForMatch: () =>
    set({
      health: MAX_HEALTH,
      alive: true,
      kills: 0,
      deaths: 0,
      scoreboard: [],
      matchEndsAt: null,
      winnerId: null,
      weaponCooldown: 0,
      abilityCooldown: 0,
    }),
  resetAll: () =>
    set({
      roomCode: null,
      isHost: false,
      matchPhase: 'room',
      roomError: null,
      lobbyPlayers: [],
      health: MAX_HEALTH,
      alive: true,
      kills: 0,
      deaths: 0,
      scoreboard: [],
      matchEndsAt: null,
      winnerId: null,
      weaponCooldown: 0,
      abilityCooldown: 0,
    }),
}))
