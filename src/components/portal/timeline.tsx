import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineEvent } from "@/data/mock";

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative space-y-6">
      {events.map((event, i) => (
        <li key={event.titulo} className="relative flex gap-4">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1",
                event.concluido
                  ? "bg-success-soft text-success ring-success/30"
                  : "bg-muted text-muted-foreground ring-border",
              )}
            >
              {event.concluido ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
            </span>
            {i < events.length - 1 ? (
              <span
                className={cn(
                  "mt-1 w-px flex-1",
                  event.concluido ? "bg-success/30" : "bg-border",
                )}
              />
            ) : null}
          </div>
          <div className="min-w-0 pb-1">
            <p className="text-sm font-medium text-foreground">{event.titulo}</p>
            <p className="text-sm text-muted-foreground">{event.descricao}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{event.data}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
