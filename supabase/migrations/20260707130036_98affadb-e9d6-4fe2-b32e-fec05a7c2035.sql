REVOKE EXECUTE ON FUNCTION public.notify_staff(text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_worker_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_advance_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_blacklist_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_profile_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_doc_number() FROM PUBLIC, anon, authenticated;