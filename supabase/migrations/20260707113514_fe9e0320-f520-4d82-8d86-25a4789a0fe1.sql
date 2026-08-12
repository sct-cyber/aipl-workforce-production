
create policy "staff read worker docs" on storage.objects for select to authenticated
  using (bucket_id = 'worker-documents' and public.is_staff(auth.uid()));
create policy "staff upload worker docs" on storage.objects for insert to authenticated
  with check (bucket_id = 'worker-documents' and public.is_staff(auth.uid()));
create policy "staff update worker docs" on storage.objects for update to authenticated
  using (bucket_id = 'worker-documents' and public.is_staff(auth.uid()));
create policy "staff delete worker docs" on storage.objects for delete to authenticated
  using (bucket_id = 'worker-documents' and public.is_staff(auth.uid()));
