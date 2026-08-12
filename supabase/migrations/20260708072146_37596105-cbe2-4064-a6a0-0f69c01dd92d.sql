
ALTER TABLE public.advance_installments
  ADD COLUMN IF NOT EXISTS payment_mode text,
  ADD COLUMN IF NOT EXISTS remarks text,
  ADD COLUMN IF NOT EXISTS entered_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false;

-- Allow admins to delete installment rows (staff write covers ALL but be explicit)
DROP POLICY IF EXISTS "admin delete installments" ON public.advance_installments;
CREATE POLICY "admin delete installments" ON public.advance_installments
  FOR DELETE USING (public.is_admin(auth.uid()));
