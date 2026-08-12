import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a stored avatar reference to a browser-usable URL.
 * - If value looks like an http(s) URL, returns as-is.
 * - Otherwise treats it as a storage path in the `avatars` bucket and
 *   creates a long-lived signed URL.
 */
export function useAvatarUrl(pathOrUrl?: string | null) {
  const q = useQuery({
    queryKey: ["avatar-url", pathOrUrl],
    enabled: !!pathOrUrl,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const v = pathOrUrl!;
      if (/^https?:\/\//i.test(v)) return v;
      const { data, error } = await supabase.storage
        .from("avatars")
        .createSignedUrl(v, 60 * 60 * 24 * 7); // 7 days
      if (error) return null;
      return data?.signedUrl ?? null;
    },
  });
  return q.data ?? null;
}
