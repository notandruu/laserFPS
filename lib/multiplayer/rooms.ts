import { supabase } from './supabase-client'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I

export function generateRoomCode(length = 6): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return code
}

export interface RoomRow {
  id: string
  created_at: string
  status: 'lobby' | 'in_progress' | 'finished'
  host_id: string
  max_kills: number
  time_limit_s: number
}

/** Creates a room with a fresh code, retrying on the rare collision. */
export async function createRoom(hostId: string): Promise<RoomRow> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode()
    const { data, error } = await supabase
      .from('rooms')
      .insert({ id: code, host_id: hostId })
      .select()
      .single()
    if (!error) return data as RoomRow
    // 23505 = unique_violation (code collision) — retry with a new code.
    if (error.code !== '23505') throw error
  }
  throw new Error('Could not allocate a room code, please try again')
}

export async function findRoom(code: string): Promise<RoomRow | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select()
    .eq('id', code.toUpperCase())
    .maybeSingle()
  if (error) throw error
  return data as RoomRow | null
}

export async function setRoomStatus(
  code: string,
  status: RoomRow['status']
) {
  const { error } = await supabase
    .from('rooms')
    .update({ status })
    .eq('id', code)
  if (error) throw error
}
