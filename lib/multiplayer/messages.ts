import type { ClassId } from './classes'

export interface TransformMsg {
  t: 'transform'
  playerId: string
  pos: [number, number, number]
  yaw: number
  pitch: number
  /** True while the beam (Class A) is actively held down */
  firing: boolean
  seq: number
  ts: number
}

export interface ShotMsg {
  t: 'shot'
  playerId: string
  weapon: 'beam' | 'burst'
  origin: [number, number, number]
  dir: [number, number, number]
  ts: number
}

/** Shooter-authoritative: the shooter's client claims a hit landed. */
export interface HitMsg {
  t: 'hit'
  shooterId: string
  victimId: string
  damage: number
  point: [number, number, number]
  weapon: 'beam' | 'burst'
  ts: number
}

/** Victim-authoritative: the only message that mutates a player's own health. */
export interface HealthMsg {
  t: 'health'
  playerId: string
  health: number
  alive: boolean
}

export interface KillMsg {
  t: 'kill'
  victimId: string
  killerId: string
  weapon: 'beam' | 'burst'
}

export interface MatchStateMsg {
  t: 'match_state'
  phase: 'lobby' | 'countdown' | 'active' | 'ended'
  endsAt: number | null
  winnerId?: string
}

export interface BlinkMsg {
  t: 'blink'
  playerId: string
  pos: [number, number, number]
  invulnUntil: number
}

export type NetMessage =
  | TransformMsg
  | ShotMsg
  | HitMsg
  | HealthMsg
  | KillMsg
  | MatchStateMsg
  | BlinkMsg

export interface PresenceMeta {
  playerId: string
  name: string
  classId: ClassId
  ready: boolean
  isHost: boolean
}
