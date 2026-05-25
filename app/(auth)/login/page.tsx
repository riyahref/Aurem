'use client'

import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserSupabaseClient()
  const router = useRouter()

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })

      if (oauthError) {
        setError(oauthError.message)
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to continue with Google.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (loginError) {
        if (loginError.message.toLowerCase().includes('email not confirmed')) {
          setError('Email confirmation is still enabled in Supabase. Turn it off if you want password login to work immediately.')
        } else {
          setError(loginError.message)
        }
        return
      }

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', data.user.id)
          .single()

        if (profileError || !profile || !profile.username) {
          router.push('/onboarding')
        } else {
          router.push('/')
        }
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-cream text-ink">
      <header className="mb-8 text-center">
        <h1 className="font-display text-6xl tracking-tighter uppercase font-black text-burgundy select-none">
          Fray
        </h1>
        <p className="font-display italic text-zinc-600 mt-2">
          where stories overlap and margins blur.
        </p>
      </header>

      <div className="w-full max-w-md card-retro p-8">
        <h2 className="font-display text-2xl font-bold mb-6 text-burgundy text-center uppercase tracking-tight">
          Log In
        </h2>

        {error && (
          <div className="p-3 mb-4 text-sm font-bold text-burgundy bg-rose/20 border-2 border-burgundy rounded">
            ✦ {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="btn-retro w-full"
        >
          {loading ? 'Connecting...' : 'Continue with Google ✦'}
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-ink/15" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">or</span>
          <div className="h-px flex-1 bg-ink/15" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="flex flex-col">
            <label htmlFor="email" className="font-display text-sm font-bold uppercase mb-1 tracking-wide">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              className="input-retro"
              placeholder="typewriter@fray.co"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="password" className="font-display text-sm font-bold uppercase mb-1 tracking-wide">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              className="input-retro"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-retro w-full mt-6"
          >
            {loading ? 'Logging in...' : 'Sign In ✦'}
          </button>
        </form>

        <div className="mt-6 text-center border-t-2 border-ink/10 pt-4">
          <p className="text-sm font-medium">
            New to Fray?{' '}
            <Link href="/signup" className="text-burgundy font-bold underline hover:text-ink">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
