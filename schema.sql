-- UPGRADE SCHEMA FOR FRAY POC
-- Run these commands in your Supabase SQL Editor (https://supabase.com/dashboard/project/ggmisgvjnvnxkyfxedvi/sql)

-- 1. Add interest tags array to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 2. Add tags array to posts
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 3. Add circle association to posts (Feature 7)
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS circle_id uuid REFERENCES public.circles(id) ON DELETE SET NULL;

-- 4. Add content warning toggle to posts (Feature 5)
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS content_warning boolean DEFAULT false;

-- 5. Add optional featured image URL to posts (Feature 3)
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS featured_image_url text;

-- 6. Add optional prompt response tag to posts (Feature 9)
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS prompt_id text;
