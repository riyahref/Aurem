'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  const supabase = createBrowserSupabaseClient()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        // Fetch profile username
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', session.user.id)
          .single()
        if (data) {
          setProfile(data)
        }
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', session.user.id)
          .single()
        if (data) setProfile(data)
      } else {
        setUser(null)
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="border-b-4 border-ink bg-cream sticky top-0 z-50 select-none">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo Masthead */}
        <div className="flex items-center gap-6">
          <Link href="/" className="font-display text-4xl uppercase font-black tracking-tighter text-burgundy hover:scale-[1.01] transition-transform">
            Fray
          </Link>
          <nav className="hidden md:flex items-center gap-4 font-display font-bold text-sm uppercase tracking-wide">
            <Link
              href="/"
              className={`hover:text-burgundy transition-colors ${
                pathname === '/' ? 'text-burgundy underline decoration-2 underline-offset-4' : 'text-ink'
              }`}
            >
              Feed
            </Link>
            <Link
              href="/confess"
              className={`hover:text-burgundy transition-colors ${
                pathname === '/confess' ? 'text-burgundy underline decoration-2 underline-offset-4' : 'text-ink'
              }`}
            >
              Confess Wall
            </Link>
            <Link
              href="/circles"
              className={`hover:text-burgundy transition-colors ${
                pathname === '/circles' ? 'text-burgundy underline decoration-2 underline-offset-4' : 'text-ink'
              }`}
            >
              Circles
            </Link>
            <Link
              href="/prompts"
              className={`hover:text-burgundy transition-colors ${
                pathname.startsWith('/prompts') ? 'text-burgundy underline decoration-2 underline-offset-4' : 'text-ink'
              }`}
            >
              Prompts
            </Link>
          </nav>
        </div>

        {/* Auth CTA / Quicklinks */}
        <div className="flex items-center gap-3">
          {!loading && user ? (
            <>
              {profile?.username && (
                <Link
                  href={`/profile/${profile.username}`}
                  className="font-mono text-xs font-bold px-3 py-1 border-2 border-ink rounded bg-[#EAE3D2] hidden sm:inline-block"
                >
                  @{profile.username}
                </Link>
              )}
              <Link href="/write" className="btn-retro text-xs py-1.5 px-3 uppercase tracking-wider font-bold">
                Write ✦
              </Link>
              <button
                onClick={handleSignOut}
                className="btn-retro-secondary text-xs py-1.5 px-3 uppercase font-bold"
              >
                Exit
              </button>
            </>
          ) : (
            !loading && (
              <>
                <Link
                  href="/login"
                  className="font-display font-black text-sm uppercase tracking-wide hover:text-burgundy px-3"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  className="btn-retro text-xs py-1.5 px-3 uppercase font-bold"
                >
                  Join ✦
                </Link>
              </>
            )
          )}
        </div>
      </div>

      {/* Sub-nav mobile masthead */}
      <div className="border-t-2 border-ink md:hidden bg-[#FAF6EB]">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-around font-display font-bold text-xs uppercase tracking-wider">
          <Link href="/" className={pathname === '/' ? 'text-burgundy underline' : 'text-ink'}>
            Feed
          </Link>
          <Link href="/confess" className={pathname === '/confess' ? 'text-burgundy underline' : 'text-ink'}>
            Confess
          </Link>
          <Link href="/circles" className={pathname === '/circles' ? 'text-burgundy underline' : 'text-ink'}>
            Circles
          </Link>
          <Link
            href="/prompts"
            className={pathname.startsWith('/prompts') ? 'text-burgundy underline' : 'text-ink'}
          >
            Prompts
          </Link>
        </div>
      </div>
    </header>
  )
}
