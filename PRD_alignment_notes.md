# Fray PRD Alignment Notes

Date: 2026-05-25

This note compares the current app against `Fray_PRD_v1.0.md` and lists the first changes I would make before adding new features.

## What I would change first

### 1. Feed should load real content immediately

Priority: Highest

Why:
- The home feed currently spends the first few seconds in a client-side loading state.
- The PRD wants the feed to feel alive, curated, and worth scrolling.
- The PRD also calls for the first 10 posts to render server-side for performance and SEO.

What to change:
- Render the initial feed from the server instead of fetching everything only in `useEffect`.
- Show seeded/demo content if the database is empty so new users do not land on an empty shell.
- Keep the tab switching client-side, but make the initial `Latest` feed instant.
- Add pagination or infinite scroll for the rest of the list.

### 2. Align onboarding with the PRD

Priority: Highest

Why:
- The PRD expects onboarding to collect:
  - unique username
  - optional display name
  - optional bio
  - 3 interest tags
- The current app only collects username and exactly 3 tags.

What to change:
- Add display name and bio to onboarding.
- Enforce username length and uniqueness exactly as the PRD describes.
- Keep interest tags aligned with the PRD tag list, not the smaller current set.
- Make onboarding completion a hard gate before the rest of the app.

### 3. Make Google OAuth the default path

Priority: High

Why:
- The PRD explicitly includes Google sign-in.
- The product should feel frictionless for first-time users.

What to change:
- Promote Google OAuth on login and signup.
- Keep email/password as an alternate path, but do not make it feel like the primary workflow.
- Make sure the callback route routes users correctly based on whether they already have a profile.

### 4. Bring the post editor up to PRD level

Priority: High

Why:
- The editor is the core creation flow.
- The PRD expects the editor to support richer publishing behavior than the current version.

Missing or incomplete versus PRD:
- Draft autosave
- Preview before publish
- Word count and character limit enforcement
- Richer editor capabilities such as image, link, and structured headings
- Better handling for post-type-specific rules
- Stronger content warning UX

### 5. Tighten anonymity rules

Priority: High

Why:
- The PRD is strict about anonymous confessions being guaranteed server-side.
- Anonymous content should never be exposed through client-side assumptions alone.

What to check:
- Confess posts should always force `is_anonymous = true` on the server.
- Anonymous posts should never leak author details in feed, profile, or API responses.
- Any moderation or delete path should preserve anonymity guarantees.

### 6. Rework feed discovery logic

Priority: Medium

Why:
- The PRD defines specific feed behavior:
  - `For You` should be personalized by tags and follows
  - `Latest` should be chronological
  - `Trending` should be based on reaction velocity, not just raw counts

What to change:
- Update `For You` to use the PRD weighting model.
- Update `Trending` to use recent reaction velocity.
- Add the UI behavior for content previews, timestamp formatting, and warning handling.

### 7. Finish profile and social graph features

Priority: Medium

Why:
- Profiles are supposed to be a major part of the product.
- The PRD expects richer profile pages, following logic, and more social context.

What to change:
- Make sure profile pages match the intended public profile model.
- Add missing follow/unfollow behavior if it is not fully complete.
- Verify counts, posts, and privacy rules are accurate.

### 8. Circles need more structure

Priority: Medium

Why:
- Circles are a core community primitive in the PRD.
- The current version is functional, but it is still closer to a basic directory than a full community layer.

What to change:
- Confirm Circle membership rules match the PRD.
- Add moderation/read-only distinctions if needed.
- Improve circle discovery and feed presentation.

### 9. Add the missing V1 support features

Priority: Medium

The PRD includes these as should-have items:
- Weekly prompts
- Direct messages
- Journal mode
- Notifications
- Search

These are not blocking the first POC polish, but they are the next major product layer after the core feed and auth flows are stable.

## My recommended order

If we want the biggest impact with the least risk, I would do this order:

1. Fix feed data loading and make the home page feel alive.
2. Align onboarding and auth with the PRD.
3. Upgrade the editor and anonymous post rules.
4. Improve feed ranking, timestamps, and preview behavior.
5. Expand profiles, circles, and social features.
6. Add V1 support features like prompts, DMs, journal mode, notifications, and search.

## Current app summary

What already looks close:
- Retro editorial visual direction
- Feed tabs for `For You`, `Latest`, and `Trending`
- Anonymous confessional behavior exists
- Circles and profiles already exist
- Reactions are implemented
- Google OAuth support has been added in the current codebase

What still feels most behind the PRD:
- Feed rendering and discovery quality
- Onboarding completeness
- Editor depth
- Strict PRD-level safety and anonymity guarantees
- V1 support features

## Note

This document is intentionally a planning note, not a code change list. It is meant to help decide the next implementation slice before editing the product.
