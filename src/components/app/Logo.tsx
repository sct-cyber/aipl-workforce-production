import logoAsset from "@/assets/ashish-interbuild-logo.jpg.asset.json";
import { cn } from "@/lib/utils";

/**
 * Ashish Interbuild company logo.
 * Renders on a white plate so the black/red mark stays legible on any theme.
 */
export function Logo({
  className,
  size = 40,
  rounded = "rounded-md",
}: {
  className?: string;
  size?: number;
  rounded?: string;
}) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden bg-white shadow-sm ring-1 ring-black/5",
        rounded,
        className,
      )}
      style={{ width: size, height: size }}
      aria-label="Ashish Interbuild"
    >
      <img
        src={logoAsset.url}
        alt="Ashish Interbuild"
        className="h-[86%] w-[86%] object-contain"
        draggable={false}
      />
    </div>
  );
}
