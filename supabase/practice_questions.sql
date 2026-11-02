-- =====================================================================
-- Topic-wise Practice Question Pool (Arithmetic / Quant practice sessions)
-- Run this in Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to run again (e.g. after updating this file) – it only creates/replaces.
-- =====================================================================

create table if not exists public.practice_questions (
  id                   uuid primary key default gen_random_uuid(),
  topic                text not null,
  difficulty           text not null default 'MEDIUM' check (difficulty in ('EASY', 'MEDIUM', 'HARD')),
  question_text        text not null default '',
  question_image_url   text,
  options              jsonb not null default '[]'::jsonb,
  correct_option_index integer not null default 0,
  solution_text        text,
  solution_image_url   text,
  created_at           timestamptz not null default now()
);

create index if not exists practice_questions_topic_idx on public.practice_questions (topic);
create index if not exists practice_questions_topic_difficulty_idx on public.practice_questions (topic, difficulty);

alter table public.practice_questions enable row level security;

-- ---------------------------------------------------------------------
-- Who is an admin?
-- profiles.is_admin = true OR app_metadata.role = 'admin' OR the owner email
-- (the same rules the website uses).
-- ---------------------------------------------------------------------
create or replace function public.is_practice_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    or coalesce(lower(auth.jwt() ->> 'email') = 'abhijeet9022102210@gmail.com', false)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true);
$$;

-- ---------------------------------------------------------------------
-- Who can READ questions (paid model)?
--   • admins
--   • everyone, when the admin has switched practice to FREE mode
--   • students with an active "Topic-wise Question Practice" purchase / email grant
--   • students with an active PRO Pass
-- ---------------------------------------------------------------------
create or replace function public.can_read_practice()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_practice_admin()
    or coalesce((
      select (s.setting_value::jsonb ->> 'isPaid') = 'false'
      from public.admin_settings s
      where s.setting_key = 'bs_practice_access_v1'
      limit 1
    ), false)
    or exists (
      select 1
      from public.student_course_purchases p
      where p.user_id = auth.uid()
        and (
          p.course_name ilike '%topic-wise question practice%'
          or p.course_name ilike '%topic practice%'
          or p.course_name ilike '%pro pass%'
        )
        and (p.expires_at is null or p.expires_at::timestamptz > now())
    );
$$;

drop policy if exists "practice_questions_public_read" on public.practice_questions;
drop policy if exists "practice_questions_paid_read" on public.practice_questions;
create policy "practice_questions_paid_read"
  on public.practice_questions for select
  using (public.can_read_practice());

-- Topic counts are public (so locked students can still see what is available)
create or replace function public.practice_topic_counts()
returns table (topic text, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select q.topic, count(*)::bigint from public.practice_questions q group by q.topic;
$$;

grant execute on function public.practice_topic_counts() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Only admins can add / edit / delete
-- ---------------------------------------------------------------------
drop policy if exists "practice_questions_admin_insert" on public.practice_questions;
create policy "practice_questions_admin_insert"
  on public.practice_questions for insert
  with check (public.is_practice_admin());

drop policy if exists "practice_questions_admin_update" on public.practice_questions;
create policy "practice_questions_admin_update"
  on public.practice_questions for update
  using (public.is_practice_admin());

drop policy if exists "practice_questions_admin_delete" on public.practice_questions;
create policy "practice_questions_admin_delete"
  on public.practice_questions for delete
  using (public.is_practice_admin());

-- Images are stored in the existing public "course_pdfs" bucket under the "practice/" folder,
-- so no new storage bucket is required.
