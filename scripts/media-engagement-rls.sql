-- Duvela media engagement RLS.
-- Safe to run more than once.
-- Lets learners interact with public posts, and lets creators read engagement
-- rows for their own posts so Media Studio can show real views/likes/comments.

alter table if exists public.posts enable row level security;
alter table if exists public.post_views enable row level security;
alter table if exists public.post_likes enable row level security;
alter table if exists public.post_comments enable row level security;

drop policy if exists "Posts are viewable by everyone" on public.posts;
drop policy if exists "Users can insert their posts" on public.posts;
drop policy if exists "Users can update their posts" on public.posts;
drop policy if exists "Users can delete their posts" on public.posts;
drop policy if exists "post_views_select" on public.post_views;
drop policy if exists "post_views_insert" on public.post_views;
drop policy if exists "Post likes are readable by everyone" on public.post_likes;
drop policy if exists "Users can like posts as themselves" on public.post_likes;
drop policy if exists "Users can remove own likes or admins can remove any" on public.post_likes;
drop policy if exists "post_likes_select" on public.post_likes;
drop policy if exists "post_likes_insert" on public.post_likes;
drop policy if exists "post_likes_delete" on public.post_likes;
drop policy if exists "Post comments are readable by everyone" on public.post_comments;
drop policy if exists "Users can insert comments as themselves" on public.post_comments;
drop policy if exists "Users can update own comments or admins can update any" on public.post_comments;
drop policy if exists "Users can delete own comments or admins can delete any" on public.post_comments;
drop policy if exists "post_comments_select" on public.post_comments;
drop policy if exists "post_comments_insert" on public.post_comments;
drop policy if exists "post_comments_delete" on public.post_comments;

drop policy if exists "posts_read_visible_media" on public.posts;
create policy "posts_read_visible_media" on public.posts
  for select to authenticated
  using (
    user_id = auth.uid()
    or coalesce(shorts_hidden, false) = false
  );

drop policy if exists "posts_creators_insert_own" on public.posts;
create policy "posts_creators_insert_own" on public.posts
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "posts_creators_update_own" on public.posts;
create policy "posts_creators_update_own" on public.posts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "posts_creators_delete_own" on public.posts;
create policy "posts_creators_delete_own" on public.posts
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "post_views_read_own_or_creator" on public.post_views;
drop policy if exists "post_views_read_visible_or_creator" on public.post_views;
create policy "post_views_read_visible_or_creator" on public.post_views
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.posts p
      where p.id = post_views.post_id
        and (
          p.user_id = auth.uid()
          or coalesce(p.shorts_hidden, false) = false
        )
    )
  );

drop policy if exists "post_views_insert_self" on public.post_views;
create policy "post_views_insert_self" on public.post_views
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "post_likes_read_own_or_creator" on public.post_likes;
drop policy if exists "post_likes_read_visible_or_creator" on public.post_likes;
create policy "post_likes_read_visible_or_creator" on public.post_likes
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.posts p
      where p.id = post_likes.post_id
        and (
          p.user_id = auth.uid()
          or coalesce(p.shorts_hidden, false) = false
        )
    )
  );

drop policy if exists "post_likes_insert_self" on public.post_likes;
create policy "post_likes_insert_self" on public.post_likes
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "post_likes_delete_self" on public.post_likes;
create policy "post_likes_delete_self" on public.post_likes
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "post_comments_read_visible_or_creator" on public.post_comments;
create policy "post_comments_read_visible_or_creator" on public.post_comments
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.posts p
      where p.id = post_comments.post_id
        and (
          p.user_id = auth.uid()
          or coalesce(p.shorts_hidden, false) = false
        )
    )
  );

drop policy if exists "post_comments_insert_self" on public.post_comments;
create policy "post_comments_insert_self" on public.post_comments
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "post_comments_update_self" on public.post_comments;
create policy "post_comments_update_self" on public.post_comments
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "post_comments_delete_self" on public.post_comments;
create policy "post_comments_delete_self" on public.post_comments
  for delete to authenticated
  using (user_id = auth.uid());

create index if not exists post_views_post_id_idx on public.post_views(post_id);
create index if not exists post_likes_post_id_idx on public.post_likes(post_id);
create index if not exists post_comments_post_id_idx on public.post_comments(post_id);
