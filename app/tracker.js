'use client'

import { useState, useEffect, useCallback } from 'react'
import styles from './tracker.module.css'
import { supabase } from '../lib/supabase'

// ─── DATA ────────────────────────────────────────────────────────────────────

const GREEN_TASKS = [
  {
    id: 'g1',
    block: 'Block 1 — Technical Depth',
    duration: '45 min',
    type: 'pick-one',
    emoji: '🧠',
    color: 'var(--green)',
    items: [
      { id: 'g1a', label: '1 medium LeetCode — string or concurrency' },
      { id: 'g1b', label: '1 system design topic, sketched on paper' },
      { id: 'g1c', label: '1 hour on MyVaastu' },
    ],
  },
  {
    id: 'g2',
    block: 'Block 2 — Visibility',
    duration: '30 min',
    type: 'pick-one',
    emoji: '✍️',
    color: '#60a5fa',
    items: [
      { id: 'g2a', label: 'Substack article progress (even 200 words)' },
      { id: 'g2b', label: 'LinkedIn post or Note draft' },
      { id: 'g2c', label: 'Reply to one person in your network' },
    ],
  },
  {
    id: 'g3',
    block: 'Block 3 — Pipeline',
    duration: '15 min',
    type: 'check-all',
    emoji: '📬',
    color: 'var(--gold)',
    items: [
      { id: 'g3a', label: 'Check active interview loops, reply to anything pending' },
      { id: 'g3b', label: 'One application IF something genuinely fits — otherwise skip' },
    ],
  },
]

const YELLOW_TASKS = {
  block: 'Pick ONE thing — that\'s it',
  emoji: '🌙',
  items: [
    { id: 'y1', label: '1 easy LeetCode problem' },
    { id: 'y2', label: 'Read 1 AI infra or distributed systems article' },
    { id: 'y3', label: 'Watch 20 min of a system design video' },
    { id: 'y4', label: 'Open MyVaastu, look at it. That counts.' },
  ],
}

const WEEKLY_SCHEDULE = [
  { day: 'Mon', mode: 'green',  focus: 'LeetCode + Substack' },
  { day: 'Tue', mode: 'green',  focus: 'System Design + MyVaastu' },
  { day: 'Wed', mode: 'yellow', focus: 'One small thing' },
  { day: 'Thu', mode: 'green',  focus: 'LeetCode + LinkedIn' },
  { day: 'Fri', mode: 'green',  focus: 'MyVaastu — ship something' },
  { day: 'Sat', mode: 'yellow', focus: 'Read or rest' },
  { day: 'Sun', mode: 'off',    focus: 'Plan next week (20 min max)' },
]

const RULES = [
  { emoji: '🔥', title: 'Streak = showing up, not output',     body: 'A Yellow Day counts the same as a Green Day. The streak is "I touched my growth today." Not "I crushed it."' },
  { emoji: '🚫', title: 'No stacking',                         body: "Miss a day? Don't make it up the next day. Just resume. Stacking is how plans collapse into shame spirals." },
  { emoji: '⏱️', title: 'The 5-minute rule',                   body: 'Commit to 5 minutes. If after 5 min you still want to stop, stop. Permission to stop is what gets you to start.' },
  { emoji: '⏰', title: 'Time block, not task block',          body: '"60 min on LeetCode" — not "solve 3 problems." Honor the time. Accept whatever output happens inside it.' },
  { emoji: '🌅', title: 'Done by 2pm',                         body: 'Morning brain > afternoon brain for technical work. Protect mornings. Afternoons are for admin, walks, rest.' },
  { emoji: '😴', title: 'One full rest day, every week',       body: 'Sunday. No LeetCode, no Substack, no LinkedIn. Fully off. This is what makes the other 6 days possible.' },
]

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const todayKey   = () => new Date().toISOString().split('T')[0]
const dayName    = () => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
}

function shortDay(dateStr) {
  return new Date(dateStr + 'T12:00:00')
    .toLocaleDateString('en-US', { weekday: 'short' })
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────

async function dbGetToday(date) {
  const { data } = await supabase.from('daily_logs').select('*').eq('date', date).single()
  return data
}

async function dbGetAllLogs() {
  const { data } = await supabase.from('daily_logs').select('date, mode, done')
  return data || []
}

async function dbUpsertLog(date, mode, completedItems, done, noteText) {
  await supabase.from('daily_logs').upsert(
    { date, mode, completed_items: completedItems, done, note_text: noteText, updated_at: new Date().toISOString() },
    { onConflict: 'date' }
  )
}

async function dbGetReview(date) {
  const { data } = await supabase.from('reviews').select('*').eq('date', date).single()
  return data
}

async function dbUpsertReview(date, q1, q2, q3) {
  await supabase.from('reviews').upsert({ date, q1, q2, q3 }, { onConflict: 'date' })
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function Tracker() {
  const [view,          setView]          = useState('today')
  const [todayData,     setTodayData]     = useState(null)
  const [history,       setHistory]       = useState({})
  const [streak,        setStreak]        = useState({ current: 0, longest: 0 })
  const [loading,       setLoading]       = useState(true)
  const [reviewAnswers, setReviewAnswers] = useState({ q1: '', q2: '', q3: '' })
  const [reviewSaved,   setReviewSaved]   = useState(false)

  // load from Supabase on mount
  useEffect(() => {
    async function loadData() {
      const today = todayKey()

      const [todayLog, allLogs, review] = await Promise.all([
        dbGetToday(today),
        dbGetAllLogs(),
        dbGetReview(today),
      ])

      if (todayLog) {
        setTodayData({ mode: todayLog.mode, completedItems: todayLog.completed_items, done: todayLog.done, noteText: todayLog.note_text || '' })
      }

      const his = {}
      allLogs.forEach(log => { his[log.date] = { mode: log.mode, done: log.done } })
      setHistory(his)

      // calculate current streak from last 7 days
      const last7 = getLast7Days()
      let cur = 0
      for (let i = last7.length - 1; i >= 0; i--) {
        if (his[last7[i]]?.done) cur++
        else break
      }

      // calculate longest streak from full history
      let longest = 0, temp = 0
      Object.keys(his).sort().forEach(date => {
        if (his[date]?.done) { temp++; longest = Math.max(longest, temp) }
        else temp = 0
      })
      setStreak({ current: cur, longest })

      if (review) { setReviewAnswers({ q1: review.q1, q2: review.q2, q3: review.q3 }); setReviewSaved(true) }

      setLoading(false)
    }

    loadData()
  }, [])

  // save today to Supabase + recalculate streak in memory
  const persistToday = useCallback(async (data) => {
    await dbUpsertLog(todayKey(), data.mode, data.completedItems, data.done, data.noteText || '')

    const newHistory = { ...history, [todayKey()]: { mode: data.mode, done: data.done } }
    setHistory(newHistory)

    const last7 = getLast7Days()
    let cur = 0
    for (let i = last7.length - 1; i >= 0; i--) {
      if (newHistory[last7[i]]?.done) cur++
      else break
    }
    const newStreak = { current: cur, longest: Math.max(streak.longest, cur) }
    setStreak(newStreak)
  }, [history, streak.longest])

  const selectMode = (mode) => {
    const data = { mode, completedItems: {}, done: false, noteText: '' }
    setTodayData(data)
    persistToday(data)
  }

  const updateNote = (text) => {
    if (!todayData) return
    setTodayData(prev => ({ ...prev, noteText: text }))
  }

  const saveNote = (text) => {
    if (!todayData) return
    const data = { ...todayData, noteText: text }
    persistToday(data)
  }

  const toggleItem = (itemId, isPickOne, groupItems) => {
    if (!todayData) return
    let ci = { ...todayData.completedItems }
    if (isPickOne) {
      groupItems.forEach(i => { ci[i.id] = false })
      ci[itemId] = !todayData.completedItems[itemId]
    } else {
      ci[itemId] = !ci[itemId]
    }
    const done = checkDone(todayData.mode, ci)
    const data = { ...todayData, completedItems: ci, done }
    setTodayData(data)
    persistToday(data)
  }

  const checkDone = (mode, items) => {
    if (mode === 'off') return true
    if (mode === 'yellow') return Object.values(items).some(Boolean)
    const b1 = GREEN_TASKS[0].items.some(i => items[i.id])
    const b2 = GREEN_TASKS[1].items.some(i => items[i.id])
    return b1 && b2
  }

  const markDone = () => {
    if (!todayData) return
    const data = { ...todayData, done: true }
    setTodayData(data)
    persistToday(data)
  }

  const saveReview = async () => {
    await dbUpsertReview(todayKey(), reviewAnswers.q1, reviewAnswers.q2, reviewAnswers.q3)
    setReviewSaved(true)
  }

  const last7 = getLast7Days()

  if (loading) {
    return (
      <div className={styles.loadWrap}>
        <div className={`${styles.loadDot} pulse`} />
      </div>
    )
  }

  return (
    <div className={styles.app}>
      {/* HEADER */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.greeting}>{getGreeting()}, Shruti</h1>
          <p className={styles.date}>
            {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
          </p>
        </div>
        <div className={styles.streakBadge}>
          <span className={styles.streakFire}>🔥</span>
          <span className={styles.streakNum}>{streak.current}</span>
          <span className={styles.streakLabel}>day streak</span>
        </div>
      </header>

      {/* NAV */}
      <nav className={styles.nav}>
        {['today','week','rules','review'].map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`${styles.navBtn} ${view === v ? styles.navActive : ''}`}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </nav>

      <main className={styles.content}>

        {/* ── TODAY ── */}
        {view === 'today' && (
          <div className="fade-in">
            {!todayData ? (
              <>
                <h2 className={styles.sectionTitle}>How's your brain today?</h2>
                <p className={styles.subtitle}>Pick honestly. Both count.</p>
                <div className={styles.modeGrid}>
                  {[
                    { mode:'green',  emoji:'🌱', name:'Green Day',  desc:'Energy online, brain ready',    meta:'90 min · 3 blocks', cls: styles.modeGreen },
                    { mode:'yellow', emoji:'🌙', name:'Yellow Day', desc:"Low energy, foggy — that's ok", meta:'20 min · 1 thing',   cls: styles.modeYellow },
                    { mode:'off',    emoji:'😴', name:'Rest Day',   desc:'Sunday or you just need it',    meta:'Fully off',          cls: styles.modeOff },
                  ].map(m => (
                    <button key={m.mode} onClick={() => selectMode(m.mode)} className={`${styles.modeCard} ${m.cls}`}>
                      <span className={styles.modeEmoji}>{m.emoji}</span>
                      <span className={styles.modeName}>{m.name}</span>
                      <span className={styles.modeDesc}>{m.desc}</span>
                      <span className={styles.modeMeta}>{m.meta}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : todayData.mode === 'off' ? (
              <div className={styles.offDay}>
                <div className={styles.offEmoji}>😴</div>
                <h2 className={styles.offTitle}>Rest Day</h2>
                <p className={styles.offBody}>
                  No LeetCode. No Substack. No LinkedIn.<br />
                  This is what makes the other 6 days possible.
                </p>
                <div className={styles.noteBlock} style={{ textAlign: 'left' }}>
                  <label className={styles.noteLabel}>Anything you want to note?</label>
                  <textarea
                    className={styles.reviewInput}
                    value={todayData.noteText || ''}
                    onChange={e => updateNote(e.target.value)}
                    onBlur={e => saveNote(e.target.value)}
                    placeholder="Something you read, thought about, or just want to remember..."
                    rows={2}
                  />
                </div>
                <button onClick={() => setTodayData(null)} className={styles.changeBtn}>Change mode</button>
              </div>
            ) : (
              <>
                <div className={styles.modeHeader}>
                  <span className={todayData.mode === 'green' ? styles.pillGreen : styles.pillPurple}>
                    {todayData.mode === 'green' ? '🌱 Green Day' : '🌙 Yellow Day'}
                  </span>
                  {todayData.done && <span className={styles.pillDone}>✓ Done</span>}
                  <button onClick={() => setTodayData(null)} className={styles.changeBtn}>change</button>
                </div>

                {todayData.mode === 'green'
                  ? GREEN_TASKS.map(group => (
                    <div key={group.id} className={styles.taskGroup}>
                      <div className={styles.taskGroupHead}>
                        <span>{group.emoji}</span>
                        <span className={styles.taskGroupTitle}>{group.block}</span>
                        <span className={styles.durationTag}>{group.duration}</span>
                        {group.type === 'pick-one' && <span className={styles.pickOneTag}>pick one</span>}
                      </div>
                      {group.items.map(item => {
                        const checked = !!todayData.completedItems?.[item.id]
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleItem(item.id, group.type === 'pick-one', group.items)}
                            className={styles.taskRow}
                          >
                            <div
                              className={styles.checkbox}
                              style={{
                                borderColor: group.color,
                                background: checked ? group.color : 'transparent',
                              }}
                            >
                              {checked && <span className={styles.checkMark}>✓</span>}
                            </div>
                            <span className={styles.taskLabel} style={{
                              textDecoration: checked ? 'line-through' : 'none',
                              color: checked ? 'var(--text4)' : 'var(--text)',
                            }}>
                              {item.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ))
                  : (
                    <div className={styles.taskGroup}>
                      <div className={styles.taskGroupHead}>
                        <span>{YELLOW_TASKS.emoji}</span>
                        <span className={styles.taskGroupTitle}>{YELLOW_TASKS.block}</span>
                      </div>
                      {YELLOW_TASKS.items.map(item => {
                        const checked = !!todayData.completedItems?.[item.id]
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleItem(item.id, true, YELLOW_TASKS.items)}
                            className={styles.taskRow}
                          >
                            <div className={styles.checkbox} style={{
                              borderColor: 'var(--purple)',
                              background: checked ? 'var(--purple)' : 'transparent',
                            }}>
                              {checked && <span className={styles.checkMark}>✓</span>}
                            </div>
                            <span className={styles.taskLabel} style={{
                              textDecoration: checked ? 'line-through' : 'none',
                              color: checked ? 'var(--text4)' : 'var(--text)',
                            }}>
                              {item.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                }

                <div className={styles.noteBlock}>
                  <label className={styles.noteLabel}>Anything else you did?</label>
                  <textarea
                    className={styles.reviewInput}
                    value={todayData.noteText || ''}
                    onChange={e => updateNote(e.target.value)}
                    onBlur={e => saveNote(e.target.value)}
                    placeholder="Note it here — a different problem, article, video, anything..."
                    rows={2}
                  />
                </div>

                {!todayData.done
                  ? <button onClick={markDone} className={styles.doneBtn}>Mark today as done ✓</button>
                  : (
                    <div className={styles.completedCard}>
                      <div className={styles.completedTitle}>Today: done. 🔥</div>
                      <p className={styles.completedBody}>Streak is alive. Go rest now.</p>
                    </div>
                  )
                }
              </>
            )}
          </div>
        )}

        {/* ── WEEK ── */}
        {view === 'week' && (
          <div className="fade-in">
            <h2 className={styles.sectionTitle}>This week</h2>

            <div className={styles.heatRow}>
              {last7.map(dateStr => {
                const d       = history[dateStr]
                const isToday = dateStr === todayKey()
                const bg      = !d          ? 'var(--border)'
                              : d.mode==='off' ? 'var(--border2)'
                              : d.done         ? 'var(--gold)'
                              :                  'var(--text4)'
                return (
                  <div key={dateStr} className={styles.heatCol}>
                    <div className={styles.heatCell} style={{
                      background: bg,
                      border: isToday ? '2px solid var(--gold)' : '2px solid transparent',
                      color: d?.done ? 'var(--bg)' : 'transparent',
                    }}>
                      {d?.mode === 'off' ? '😴' : d?.done ? '✓' : isToday ? '·' : ''}
                    </div>
                    <span className={styles.heatLabel} style={{ color: isToday ? 'var(--gold)' : 'var(--text4)' }}>
                      {shortDay(dateStr)}
                    </span>
                  </div>
                )
              })}
            </div>

            <h2 className={styles.sectionTitle} style={{ marginTop: 28 }}>Default schedule</h2>
            {WEEKLY_SCHEDULE.map(row => (
              <div key={row.day} className={styles.schedRow}>
                <span className={styles.schedDay}>{row.day}</span>
                <span className={styles.schedPill} style={{
                  background: row.mode==='green'  ? 'rgba(74,222,128,0.12)'
                            : row.mode==='yellow' ? 'rgba(192,132,252,0.12)'
                            :                       'rgba(100,100,100,0.12)',
                  color:      row.mode==='green'  ? 'var(--green)'
                            : row.mode==='yellow' ? 'var(--purple)'
                            :                       'var(--text3)',
                }}>
                  {row.mode==='green' ? '🌱' : row.mode==='yellow' ? '🌙' : '😴'} {row.mode}
                </span>
                <span className={styles.schedFocus}>{row.focus}</span>
              </div>
            ))}

            <div className={styles.statsRow}>
              {[
                { num: streak.current,                                              label: 'current streak' },
                { num: streak.longest,                                              label: 'longest streak' },
                { num: Object.values(history).filter(d => d.done).length,           label: 'total days done' },
              ].map(s => (
                <div key={s.label} className={styles.statCard}>
                  <span className={styles.statNum}>{s.num}</span>
                  <span className={styles.statLabel}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RULES ── */}
        {view === 'rules' && (
          <div className="fade-in">
            <h2 className={styles.sectionTitle}>The rules that make this survive</h2>
            {RULES.map(r => (
              <div key={r.title} className={styles.ruleCard}>
                <span className={styles.ruleEmoji}>{r.emoji}</span>
                <div>
                  <div className={styles.ruleTitle}>{r.title}</div>
                  <div className={styles.ruleBody}>{r.body}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── REVIEW ── */}
        {view === 'review' && (
          <div className="fade-in">
            <h2 className={styles.sectionTitle}>Sunday review</h2>
            <p className={styles.subtitle}>Three questions. Write the answers, don't just think them.</p>

            {[
              { key:'q1', q:'What did I actually do this week?',  hint:'List it out, even small wins.' },
              { key:'q2', q:'What worked, what didn\'t?',          hint:'Be honest, not harsh.' },
              { key:'q3', q:'What\'s the one thing for next week?', hint:'Just one.' },
            ].map(item => (
              <div key={item.key} className={styles.reviewBlock}>
                <div className={styles.reviewQ}>{item.q}</div>
                <div className={styles.reviewHint}>{item.hint}</div>
                <textarea
                  className={styles.reviewInput}
                  value={reviewAnswers[item.key]}
                  onChange={e => setReviewAnswers(p => ({ ...p, [item.key]: e.target.value }))}
                  placeholder="Write here..."
                  rows={3}
                  disabled={reviewSaved}
                />
              </div>
            ))}

            {!reviewSaved
              ? <button onClick={saveReview} className={styles.doneBtn}>Save review</button>
              : (
                <div className={styles.completedCard}>
                  <div className={styles.completedTitle}>Saved ✓</div>
                  <p className={styles.completedBody}>
                    <button onClick={() => setReviewSaved(false)} className={styles.editBtn}>edit</button>
                  </p>
                </div>
              )
            }
          </div>
        )}

      </main>
    </div>
  )
}
