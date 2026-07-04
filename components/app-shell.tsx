'use client'

import { useState } from 'react'
import { LaserGame } from '@/components/laser/laser-game'
import { MultiplayerGame } from '@/components/multiplayer/multiplayer-game'

function initialMode(): 'solo' | 'multiplayer' {
  return new URLSearchParams(window.location.search).get('room') ? 'multiplayer' : 'solo'
}

export function AppShell() {
  const [mode, setMode] = useState<'solo' | 'multiplayer'>(initialMode)

  return (
    <main className="h-dvh w-full overflow-hidden bg-black">
      {mode === 'solo' ? (
        <LaserGame onMultiplayer={() => setMode('multiplayer')} />
      ) : (
        <MultiplayerGame onExit={() => setMode('solo')} />
      )}
    </main>
  )
}
