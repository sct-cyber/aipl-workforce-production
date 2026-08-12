import { supabase } from "@/integrations/supabase/client";

export const BLACKLIST_CATEGORIES = [
  { value: "theft", label: "Theft" },
  { value: "violence", label: "Violence" },
  { value: "fraud", label: "Fraud" },
  { value: "substance_abuse", label: "Substance Abuse" },
  { value: "safety_violation", label: "Safety Violation" },
  { value: "absconding", label: "Absconding" },
  { value: "misconduct", label: "Misconduct" },
  { value: "other", label: "Other" },
] as const;

export type BlacklistCategory = typeof BLACKLIST_CATEGORIES[number]["value"];

export const categoryLabel = (v?: string | null) =>
  BLACKLIST_CATEGORIES.find(c => c.value === v)?.label ?? (v ?? "—");

export type BlacklistHit = {
  entry_id: string;
  worker_id: string;
  full_name: string;
  aadhaar_number: string | null;
  category: string;
  reason: string;
  added_at: string;
  previous_project: string | null;
  previous_designation: string | null;
};

/**
 * Look up any ACTIVE blacklist entry for a worker matching the given Aadhaar.
 * Returns null if no hit.
 */
export async function checkAadhaarBlacklist(aadhaar: string): Promise<BlacklistHit | null> {
  if (!/^\d{12}$/.test(aadhaar)) return null;
  const { data: worker } = await supabase
    .from("workers")
    .select("id, full_name, aadhaar_number")
    .eq("aadhaar_number", aadhaar)
    .maybeSingle();
  if (!worker) return null;
  const { data: entry } = await supabase
    .from("blacklist_entries")
    .select("id, worker_id, category, reason, added_at, previous_project, previous_designation")
    .eq("worker_id", worker.id)
    .eq("active", true)
    .order("added_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!entry) return null;
  return {
    entry_id: entry.id,
    worker_id: worker.id,
    full_name: worker.full_name,
    aadhaar_number: worker.aadhaar_number,
    category: entry.category,
    reason: entry.reason,
    added_at: entry.added_at,
    previous_project: (entry as any).previous_project ?? null,
    previous_designation: (entry as any).previous_designation ?? null,
  };
}
