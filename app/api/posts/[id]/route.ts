import { NextResponse } from 'next/server'
import { createApiServerClient } from '@/lib/superbase-server'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createApiServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, author_id, is_anonymous, is_published')
      .eq('id', id)
      .maybeSingle()

    if (postError) {
      return NextResponse.json({ error: postError.message }, { status: 500 })
    }

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (post.author_id !== user.id || post.is_anonymous) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await supabase.from('reactions').delete().eq('post_id', id)

    const { error: updateError } = await supabase
      .from('posts')
      .update({
        is_published: false,
      })
      .eq('id', id)
      .eq('author_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
