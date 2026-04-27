import { supabase } from './supabase'

export async function dbGetToday(date) {
  const { data } = await supabase.from('daily_logs').select('*').eq('date', date).single()
  return data
}

export async function dbGetAllLogs() {
  const { data } = await supabase.from('daily_logs').select('date, mode, done')
  return data || []
}

export async function dbUpsertLog(date, mode, completedItems, done, noteText) {
  await supabase.from('daily_logs').upsert(
    { date, mode, completed_items: completedItems, done, note_text: noteText, updated_at: new Date().toISOString() },
    { onConflict: 'date' }
  )
}

export async function dbGetReview(date) {
  const { data } = await supabase.from('reviews').select('*').eq('date', date).single()
  return data
}

export async function dbUpsertReview(date, q1, q2, q3) {
  await supabase.from('reviews').upsert({ date, q1, q2, q3 }, { onConflict: 'date' })
}
