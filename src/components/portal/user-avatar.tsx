import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .replace(/^(Dr|Dra)\.?\s+/i, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function UserAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-accent-foreground ring-1 ring-primary/15",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
