
revoke execute on function public.has_role(uuid, app_role) from public, anon;
revoke execute on function public.is_staff(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_worker_blacklist_status() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon;
