import { notify } from "@/components/Notify";
import { useEffect, useRef } from "react";
import { Sheet, SheetHeader } from "./ui";
import { InterestPicker } from "./Onboarding";
import { closeOverlay } from "@/lib/ui";
import { getState, updateInterests } from "@/lib/store";
import type { Category } from "@/lib/types";

export function InterestsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  // What the reader had when they opened the sheet, so a save can be undone.
  const before = useRef<Category[]>([]);
  useEffect(() => {
    if (open) before.current = [...(getState().profile?.picked ?? [])];
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title="Edit interests" tall>
      <SheetHeader title="My favorite topics" onClose={onClose} />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto" data-vaul-no-drag>
        {open && (
          <InterestPicker
            mode="edit"
            onDone={() => {
              const prev = before.current;
              closeOverlay();
              notify("Interests updated", {
                action: { label: "Undo", onClick: () => updateInterests(prev) },
                duration: 3200,
              });
            }}
          />
        )}
      </div>
    </Sheet>
  );
}
