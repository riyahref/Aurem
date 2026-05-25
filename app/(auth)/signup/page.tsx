'use client'

import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      if (data.session) {
        router.push('/onboarding')
      } else {
        setSuccess(true)
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
          Create an Account
        </h2>

        {error && (
          <div className="p-3 mb-4 text-sm font-bold text-burgundy bg-rose/20 border-2 border-burgundy rounded">
            ✦ {error}
          </div>
        )}

        {success ? (
          <div className="text-center py-4">
            <div className="p-4 mb-4 text-sm font-bold text-ink bg-gold/20 border-2 border-ink rounded">
              ✦ Account created. If you do not land in the app immediately, email confirmation is still enabled in Supabase.
            </div>
            <Link href="/login" className="btn-retro w-full mt-4">
              Go to Login
            </Link>
          </div>
        ) : (
          <>
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

            <form onSubmit={handleSignUp} className="space-y-4">
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
                {loading ? 'Registering...' : 'Sign Up ✦'}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 text-center border-t-2 border-ink/10 pt-4">
          <p className="text-sm font-medium">
            Already have an account?{' '}
            <Link href="/login" className="text-burgundy font-bold underline hover:text-ink">
              Log in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
