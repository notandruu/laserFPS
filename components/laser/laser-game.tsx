'use client'

import dynamic from 'next/dynamic'
import { Hud } from './hud'

const LaserScene = dynamic(
  () => import('./scene').then((m) => m.LaserScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-black font-mono text-xs tracking-[0.4em] text-white/50">
        CHARGING LASER...
      </div>
    ),
  }
)

export function LaserGame() {
  return (
    <div className="relative h-dvh w-full cursor-none overflow-hidden bg-black">
      <LaserScene />
      <Hud />
    </div>
  )
}
