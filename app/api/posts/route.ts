import { createApiServerClient } from '@/lib/superbase-server'
import { getPromptById } from '@/lib/prompts'
import { NextResponse } from 'next/server'

function normalizeImageUrl(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith('data:image/')) {
    return trimmed
  }

  try {
    const url = new URL(trimmed)
    if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'data:') {
      return url.toString()
    }
  } catch {
    return null
  }

  return null
}

function normalizePostTypeForStorage(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const lower = trimmed.toLowerCase()
  if (lower === 'rant' || lower === 'confess' || lower === 'story') {
    return lower
  }

  const title = lower.charAt(0).toUpperCase() + lower.slice(1)
  if (title === 'Rant' || title === 'Confess' || title === 'Story') {
    return title
  }

  return trimmed
}

function sanitizeAnonymousPost<T extends { author_id?: string | null; profiles?: { username: string; avatar_url: string | null } | null; is_anonymous?: boolean }>(
  post: T
) {
  if (!post.is_anonymous) {
    return post
  }

  return {
    ...post,
    author_id: null,
    profiles: {
      username: 'Anonymous',
      avatar_url: null,
    },
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createApiServerClient()

    // 1. Get the current user session
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse request body
    const body = await req.json()
    const { title, content, post_type, tags, circle_id, content_warning, featured_image_url, prompt_id } = body

    if (!content || !post_type) {
      return NextResponse.json({ error: 'Missing content or post type' }, { status: 400 })
    }

    // 3. Server-side Anonymity and Integrity Enforcer
    const canonicalPostType = normalizePostTypeForStorage(post_type)
    if (!canonicalPostType) {
      return NextResponse.json({ error: 'Unsupported post type' }, { status: 400 })
    }

    const isConfession = canonicalPostType.toLowerCase() === 'confess'
    const is_anonymous = isConfession ? true : false
    const prompt = typeof prompt_id === 'string' ? getPromptById(prompt_id) : null

    const insertPayload = {
      author_id: user.id,
      title: title || 'Untitled',
      content,
      post_type: canonicalPostType,
      tags: Array.isArray(tags) ? tags : [],
      circle_id: circle_id || null,
      content_warning: isConfession ? !!content_warning : false,
      featured_image_url: canonicalPostType.toLowerCase() === 'story' ? normalizeImageUrl(featured_image_url) : null,
      prompt_id: prompt?.id ?? null,
      is_anonymous,
      is_published: true
    }

    let insertResult = await supabase
      .from('posts')
      .insert(insertPayload)
      .select('*, profiles!posts_author_id_fkey(username)')
      .single()

    if (insertResult.error?.message?.includes('posts_post_type_check')) {
      const fallbackPostType = canonicalPostType === canonicalPostType.toLowerCase()
        ? canonicalPostType.charAt(0).toUpperCase() + canonicalPostType.slice(1)
        : canonicalPostType.toLowerCase()

      insertResult = await supabase
        .from('posts')
        .insert({
          ...insertPayload,
          post_type: fallbackPostType,
          featured_image_url: fallbackPostType.toLowerCase() === 'story'
            ? normalizeImageUrl(featured_image_url)
            : null,
          content_warning: fallbackPostType.toLowerCase() === 'confess' ? !!content_warning : false,
          is_anonymous: fallbackPostType.toLowerCase() === 'confess' ? true : false,
        })
        .select('*, profiles!posts_author_id_fkey(username)')
        .single()
    }

    const { data: newPost, error: insertError } = insertResult

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json(sanitizeAnonymousPost(newPost))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const supabase = await createApiServerClient()

    const isPublished = searchParams.get('is_published') !== 'false'
    const isAnonymousOnly = searchParams.get('is_anonymous') === 'true'
    const circleId = searchParams.get('circle_id')
    const promptId = searchParams.get('prompt_id')
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const anonymousSelect =
      'id, title, content, post_type, tags, is_anonymous, content_warning, featured_image_url, prompt_id, created_at, circle_id, profiles!posts_author_id_fkey(username, avatar_url)'
    const standardSelect = '*, profiles!posts_author_id_fkey(username, avatar_url)'

    let query = supabase
      .from('posts')
      .select(isAnonymousOnly ? anonymousSelect : standardSelect)
      .eq('is_published', isPublished)
      .order('created_at', { ascending: false })

    if (isAnonymousOnly) {
      query = query.eq('is_anonymous', true)
    }

    if (circleId) {
      query = query.eq('circle_id', circleId)
    }

    if (promptId) {
      query = query.eq('prompt_id', promptId)
    }

    const { data: posts, error: fetchError } = await query.limit(limit)

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // FAANG Privacy Layer: Clean up author_id and profiles if is_anonymous is true
    const sanitizedPosts = posts.map((post) => sanitizeAnonymousPost(post))

    return NextResponse.json(sanitizedPosts)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
