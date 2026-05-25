import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const path = req.nextUrl.pathname
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/signup')
  const isConfessRoute = path.startsWith('/confess')
  const isPublicApiRoute = path.startsWith('/api/auth')
  const isProtectedRoute =
    path === '/' ||
    path.startsWith('/write') ||
    path.startsWith('/circles') ||
    path.startsWith('/profile') ||
    path.startsWith('/onboarding')

  if (!session) {
    if (isProtectedRoute) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    return res
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', session.user.id)
    .maybeSingle()

  const hasCompletedOnboarding = !!profile?.username

  if (isAuthRoute) {
    return NextResponse.redirect(new URL(hasCompletedOnboarding ? '/' : '/onboarding', req.url))
  }

  if (!hasCompletedOnboarding && !isConfessRoute && !isPublicApiRoute) {
    if (!path.startsWith('/onboarding')) {
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }
  }

  if (hasCompletedOnboarding && path.startsWith('/onboarding')) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
