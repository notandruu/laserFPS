'use client'

import * as THREE from 'three'

export const PLAYER_HEIGHT = 1.6
export const ARENA_RADIUS = 28

/** Live local-player position. The controller owns it, enemies/remote players read it. */
export const PLAYER_POS = new THREE.Vector3(0, PLAYER_HEIGHT, 0)
