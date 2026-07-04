export type ClassId = 'A' | 'B'

export interface ClassConfig {
  id: ClassId
  name: string
  weaponName: string
  abilityName: string
  tagline: string
  /** Accent color used for this class's weapon glow and remote-player tint */
  accentColor: string
}

export const CLASSES: Record<ClassId, ClassConfig> = {
  A: {
    id: 'A',
    name: 'STRIKER',
    weaponName: 'BEAM',
    abilityName: 'DASH',
    tagline: 'Continuous beam, hold to melt. Dash slides in your movement direction.',
    accentColor: '#e8e8e8',
  },
  B: {
    id: 'B',
    name: 'PHANTOM',
    weaponName: 'BURST',
    abilityName: 'BLINK',
    tagline: '3-round burst rifle. Blink teleports instantly with brief invulnerability.',
    accentColor: '#c98bff',
  },
}

/** Class A: reuses the exact solo-mode beam/pulse-derived numbers. */
export const CLASS_A = {
  beamDps: 55,
  dashCooldown: 1.15,
  dashDistance: 6.4,
}

/** Class B: burst rifle + blink. */
export const CLASS_B = {
  burstShotDamage: 18,
  burstShotCount: 3,
  burstShotInterval: 0.05,
  burstCooldown: 0.9,
  blinkCooldown: 1.15,
  blinkDistance: 6.4,
  blinkInvulnSeconds: 0.15,
}
