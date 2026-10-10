import { Sheet } from "./ui";
import { InterestPicker } from "./Onboarding";
import { closeOverlay } from "@/lib/ui";
import { toast } from "sonner";

export function InterestsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Edit interests" tall>
      <div className="no-scrollbar flex-1 overflow-y-auto" data-vaul-no-drag>
        {open && (
          <InterestPicker
            mode="edit"
            onDone={() => {
              closeOverlay();
              toast("Interests updated. New topics will follow them.", { duration: 2400 });
            }}
          />
        )}
      </div>
    </Sheet>
  );
}
