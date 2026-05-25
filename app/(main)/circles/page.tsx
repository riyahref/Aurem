'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

interface Circle {
  id: string
  name: string
  slug: string
  description: string
  created_at: string
}

interface CircleWithStats extends Circle {
  memberCount: number
  isMember: boolean
}

type ViewMode = 'all' | 'joined'

export default function CirclesPage() {
  const [circles, setCircles] = useState<CircleWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('all')

  const supabase = createBrowserSupabaseClient()

  const loadCircles = async () => {
    setLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const currentUid = session?.user?.id || null
      setUserId(currentUid)

      const [{ data: rawCircles, error: circErr }, { data: rawMembers, error: memErr }] =
        await Promise.all([
          supabase.from('circles').select('*').order('name', { ascending: true }),
          supabase.from('circle_members').select('*'),
        ])

      if (circErr) throw circErr
      if (memErr) throw memErr

      const memberCounts: { [circleId: string]: number } = {}
      const myMemberships = new Set<string>()

      rawMembers?.forEach((membership) => {
        memberCounts[membership.circle_id] = (memberCounts[membership.circle_id] || 0) + 1
        if (currentUid && membership.user_id === currentUid) {
          myMemberships.add(membership.circle_id)
        }
      })

      const enrichedCircles = (rawCircles || []).map((circle) => ({
        ...circle,
        memberCount: memberCounts[circle.id] || 0,
        isMember: myMemberships.has(circle.id),
      }))

      setCircles(enrichedCircles)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCircles()
  }, [])

  const handleJoinToggle = async (circleId: string, currentlyMember: boolean) => {
    if (!userId) {
      alert('Please log in to join circles!')
      return
    }

    const targetCircle = circles.find((circle) => circle.id === circleId)
    if (!targetCircle) {
      return
    }

    const originalState = { ...targetCircle }

    setCircles((prev) =>
      prev.map((circle) =>
        circle.id === circleId
          ? {
              ...circle,
              isMember: !currentlyMember,
              memberCount: currentlyMember ? circle.memberCount - 1 : circle.memberCount + 1,
            }
          : circle
      )
    )

    try {
      if (currentlyMember) {
        const { error } = await supabase
          .from('circle_members')
          .delete()
          .eq('circle_id', circleId)
          .eq('user_id', userId)

        if (error) throw error
      } else {
        const { error } = await supabase.from('circle_members').insert({
          circle_id: circleId,
          user_id: userId,
        })

        if (error) throw error
      }
    } catch (err) {
      console.error('Failed to update membership, rolling back...', err)
      setCircles((prev) => prev.map((circle) => (circle.id === circleId ? originalState : circle)))
    }
  }

  const joinedCircles = useMemo(() => circles.filter((circle) => circle.isMember), [circles])
  const filteredCircles = useMemo(() => {
    const source = viewMode === 'joined' ? joinedCircles : circles
    const needle = search.trim().toLowerCase()

    if (!needle) {
      return source
    }

    return source.filter((circle) => {
      return (
        circle.name.toLowerCase().includes(needle) ||
        circle.description.toLowerCase().includes(needle) ||
        circle.slug.toLowerCase().includes(needle)
      )
    })
  }, [circles, joinedCircles, search, viewMode])

  const featuredCircle = useMemo(() => {
    if (joinedCircles.length > 0) {
      return joinedCircles[0]
    }

    return circles[0] ?? null
  }, [circles, joinedCircles])

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b-4 border-ink pb-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="font-display text-4xl font-black uppercase tracking-tight text-burgundy">
            Community Circles
          </h1>
          <p className="font-display italic text-zinc-600">
            Browse active circles, align coordinates, and join localized printing presses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
            <span className="rounded-full border border-ink/20 bg-cream px-3 py-1">
              {circles.length} circles
            </span>
            <span className="rounded-full border border-ink/20 bg-cream px-3 py-1">
              {joinedCircles.length} joined
            </span>
            <span className="rounded-full border border-ink/20 bg-cream px-3 py-1">
              {circles.reduce((sum, circle) => sum + circle.memberCount, 0)} memberships
            </span>
          </div>
          <Link
            href="/circles/new"
            className="btn-retro bg-burgundy text-cream text-xs uppercase font-bold px-5 py-2.5"
          >
            + Create Circle
          </Link>
        </div>
      </header>

      {featuredCircle && (
        <section className="card-retro p-6 bg-[#FAF6EB] border-ink flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">
                Featured circle
              </p>
              <h2 className="font-display text-3xl font-black uppercase tracking-tight text-burgundy">
                {featuredCircle.name}
              </h2>
              <p className="text-sm font-serif text-zinc-700 max-w-2xl leading-relaxed">
                {featuredCircle.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/circles/${featuredCircle.slug}`}
                className="btn-retro-secondary text-xs uppercase px-5 py-2.5 font-bold"
              >
                Open Circle
              </Link>
              {userId && (
                <button
                  onClick={() => handleJoinToggle(featuredCircle.id, featuredCircle.isMember)}
                  className={`btn-retro text-xs uppercase px-5 py-2.5 font-bold ${
                    featuredCircle.isMember ? 'bg-ink text-cream hover:bg-zinc-800' : 'bg-burgundy text-cream'
                  }`}
                >
                  {featuredCircle.isMember ? 'Leave Circle' : 'Join Circle'}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded border-2 border-ink bg-[#FAF6EB] p-4 shadow-[3px_3px_0px_var(--ink)] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2">
            {(['all', 'joined'] as ViewMode[]).map((mode) => {
              const isActive = viewMode === mode
              const label = mode === 'all' ? 'All Circles' : 'Joined'

              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`px-4 py-2 text-xs font-display font-bold uppercase tracking-wider border-2 border-ink rounded transition-all ${
                    isActive ? 'bg-burgundy text-cream' : 'bg-cream text-ink hover:bg-[#FAF6EB]'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input-retro max-w-full lg:max-w-sm"
            placeholder="Search circles or slugs..."
          />
        </div>

        {loading ? (
          <div className="py-12 text-center font-mono text-zinc-400 animate-pulse">
            Opening community registry...
          </div>
        ) : filteredCircles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredCircles.map((circle) => (
              <article key={circle.id} className="card-retro p-6 bg-[#FAF6EB] flex flex-col gap-4">
                <div className="border-b-2 border-ink/10 pb-3 flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/circles/${circle.slug}`}
                      className="font-display text-xl font-black uppercase tracking-tight text-burgundy hover:underline"
                    >
                      {circle.name}
                    </Link>
                    <div className="text-xs font-mono text-zinc-500 mt-0.5">/circles/{circle.slug}</div>
                  </div>
                  <span className="badge-retro text-[9px] font-mono select-none">
                    {circle.memberCount} members
                  </span>
                </div>

                <p className="text-sm font-serif text-zinc-700 leading-relaxed flex-1 line-clamp-3">
                  {circle.description}
                </p>

                <div className="flex gap-2 pt-4 border-t-2 border-ink/10 mt-auto">
                  <Link
                    href={`/circles/${circle.slug}`}
                    className="btn-retro-secondary text-xs py-2 px-4 uppercase font-bold flex-1 text-center"
                  >
                    View Feed
                  </Link>
                  {userId && (
                    <button
                      onClick={() => handleJoinToggle(circle.id, circle.isMember)}
                      className={`btn-retro text-xs py-2 px-4 uppercase font-bold flex-1 ${
                        circle.isMember ? 'bg-ink text-cream hover:bg-zinc-800' : 'bg-burgundy text-cream'
                      }`}
                    >
                      {circle.isMember ? 'Leave' : 'Join'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="card-retro p-12 text-center bg-[#FAF6EB]">
            <div className="text-3xl mb-2">{viewMode === 'joined' ? '🏜️' : '✦'}</div>
            <h3 className="font-display text-lg font-bold uppercase text-burgundy">
              {viewMode === 'joined' ? 'No Joined Circles' : 'No circles yet'}
            </h3>
            <p className="text-xs font-serif text-zinc-600 mt-1 max-w-xs mx-auto leading-relaxed">
              {viewMode === 'joined'
                ? 'You have not joined any circles yet. Browse the full directory to start reading locally.'
                : search
                  ? 'No circles matched your search. Try a different term or start a new one.'
                  : 'No circles exist yet — be the first to start one.'}
            </p>
            {viewMode === 'joined' ? (
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className="btn-retro text-xs mt-4 uppercase font-bold"
              >
                Browse All Circles
              </button>
            ) : (
              <Link
                href="/circles/new"
                className="btn-retro bg-burgundy text-cream text-xs mt-4 uppercase font-bold inline-block px-5 py-2.5"
              >
                + Create a Circle
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
