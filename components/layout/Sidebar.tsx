'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

interface Circle {
  id: string
  name: string
  slug: string
  description: string
}

export default function Sidebar() {
  const [profile, setProfile] = useState<any>(null)
  const [circles, setCircles] = useState<Circle[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          const { data: profData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          if (profData) {
            setProfile(profData)
          }
        }

        const { data: circData } = await supabase
          .from('circles')
          .select('*')
          .limit(5)

        if (circData) {
          setCircles(circData)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase])

  return (
    <aside className="w-full lg:w-80 flex flex-col gap-6 select-none">
      {/* 1. Profile / Onboarding Coordinates Card */}
      {profile ? (
        <div className="card-retro p-6 bg-[#FAF6EB] flex flex-col gap-4">
          <div className="border-b-2 border-ink/10 pb-3">
            <h4 className="font-display text-xs font-black uppercase text-burgundy tracking-widest">
              Reader Credentials
            </h4>
            <div className="font-display text-xl font-black mt-1 uppercase tracking-tight text-ink">
              @{profile.username}
            </div>
            {profile.display_name && (
              <div className="text-xs font-mono text-zinc-500 mt-0.5">
                {profile.display_name}
              </div>
            )}
          </div>

          {profile.bio && (
            <p className="text-xs italic text-zinc-600 font-serif leading-relaxed">
              "{profile.bio}"
            </p>
          )}

          <div>
            <h5 className="font-display text-[10px] font-black uppercase text-zinc-500 tracking-wider mb-2">
              Onboarded Coordinates:
            </h5>
            <div className="flex flex-wrap gap-1.5">
              {profile.tags && profile.tags.length > 0 ? (
                profile.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 border border-ink text-[10px] font-mono font-bold uppercase rounded bg-rose/20 text-burgundy"
                  >
                    ✦ {tag}
                  </span>
                ))
              ) : (
                <Link
                  href="/onboarding"
                  className="text-xs text-burgundy font-bold hover:underline"
                >
                  Configure Tags
                </Link>
              )}
            </div>
          </div>

          <Link
            href={`/profile/${profile.username}`}
            className="btn-retro text-xs py-2 text-center w-full uppercase"
          >
            My Magazine Grid ✦
          </Link>
        </div>
      ) : (
        <div className="card-retro p-6 bg-[#EAE3D2] border-dashed text-center">
          <h4 className="font-display text-sm font-black uppercase text-burgundy mb-2">
            Marginalized?
          </h4>
          <p className="text-xs text-zinc-600 mb-4 font-serif leading-relaxed">
            Create a press card to publish stories, react with stamps, and coordinate in circles.
          </p>
          <Link href="/signup" className="btn-retro w-full text-xs uppercase font-bold">
            Sign Up ✦
          </Link>
        </div>
      )}

      {/* 2. Popular Circles Widget */}
      <div className="card-retro p-6 bg-[#FAF6EB]">
        <h4 className="font-display text-xs font-black uppercase text-burgundy tracking-widest border-b-2 border-ink/10 pb-3 mb-4">
          Popular Circles
        </h4>
        
        {loading ? (
          <div className="text-xs font-mono text-zinc-400">Loading indexes...</div>
        ) : circles.length > 0 ? (
          <ul className="space-y-4">
            {circles.map((circle) => (
              <li key={circle.id} className="group">
                <Link
                  href={`/circles/${circle.slug}`}
                  className="font-display font-black text-sm uppercase text-ink group-hover:text-burgundy transition-colors block"
                >
                  ● {circle.name}
                </Link>
                <p className="text-xs text-zinc-500 font-serif leading-snug line-clamp-2 mt-1">
                  {circle.description}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs italic text-zinc-500 font-serif">
            No circles established yet.
          </div>
        )}

        <Link
          href="/circles"
          className="text-xs font-bold text-burgundy hover:underline mt-4 block text-center uppercase tracking-wide border-t border-ink/10 pt-3"
        >
          Browse All Circles ✦
        </Link>
      </div>
    </aside>
  )
}
