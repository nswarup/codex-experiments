import { useCallback, useEffect, useState } from "react";
import { useUi, closeOverlay, type Overlay } from "@/lib/ui";
import { cue } from "@/lib/feedback";
import { PeekSheet } from "./Peek";
import { ChatSheet } from "./Chat";
import { SearchOverlay } from "./Search";
import { SettingsSheet } from "./Settings";
import { LibrarySheet } from "./Library";
import { WhySheet } from "./Why";
import { InterestsSheet } from "./InterestsSheet";

type Kind = Overlay["kind"];

/**
 * Keeps the last data for each overlay kind so sheets can animate closed
 * after the overlay state has already been cleared.
 */
export function Overlays() {
  const overlay = useUi((s) => s.overlay);
  const [last, setLast] = useState<Partial<Record<Kind, Overlay>>>({});

  useEffect(() => {
    if (overlay) setLast((l) => ({ ...l, [overlay.kind]: overlay }));
  }, [overlay]);

  const is = (k: Kind) => overlay?.kind === k;
  const close = useCallback(() => {
    cue("close", { emphasis: "subtle" });
    closeOverlay();
  }, []);
  const get = <K extends Kind>(k: K) => (overlay?.kind === k ? overlay : last[k]) as Extract<Overlay, { kind: K }> | undefined;

  const peek = get("peek");
  const chat = get("chat");
  const why = get("why");
  const library = get("library");

  return (
    <>
      {peek && <PeekSheet open={is("peek")} data={peek} onClose={close} />}
      {chat && <ChatSheet open={is("chat")} data={chat} onClose={close} />}
      <SearchOverlay open={is("search")} onClose={close} />
      <SettingsSheet open={is("settings")} onClose={close} />
      <LibrarySheet open={is("library")} tab={library?.tab} onClose={close} />
      {why && <WhySheet open={is("why")} data={why} onClose={close} />}
      <InterestsSheet open={is("interests")} onClose={close} />
    </>
  );
}
