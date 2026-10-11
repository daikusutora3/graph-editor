import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";

type ActionTicket = {
  id: number;
  revision: number;
  inputKey: string;
};

/** Explicit actions finish independently of preview lifetime or settings edits. */
export function useScreenshotAction<State extends string>(
  inputKey: string,
  mountedRef: MutableRefObject<boolean>,
) {
  const owner = useRef({
    nextId: 0,
    revision: 0,
    inputKey,
    pending: null as ActionTicket | null,
  });
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<
    (ActionTicket & { state: State; message: string }) | null
  >(null);

  useEffect(() => {
    // Graph/theme/viewport changes also invalidate completed feedback. Keep
    // identical Strict Mode effect replay from inventing a settings revision.
    if (owner.current.inputKey === inputKey) return;
    owner.current.inputKey = inputKey;
    owner.current.revision += 1;
    setFeedback(null);
  }, [inputKey]);

  const begin = (): ActionTicket | null => {
    if (!mountedRef.current || owner.current.pending) return null;
    const ticket = {
      id: ++owner.current.nextId,
      revision: owner.current.revision,
      inputKey,
    };
    owner.current.pending = ticket;
    setPending(true);
    setFeedback(null);
    return ticket;
  };

  const finish = (ticket: ActionTicket, state: State, message = "") => {
    if (owner.current.pending !== ticket) return;
    owner.current.pending = null;
    if (!mountedRef.current) return;
    setPending(false);
    if (ticket.revision === owner.current.revision) {
      setFeedback({ ...ticket, state, message });
    }
  };

  const resetFeedback = () => {
    owner.current.revision += 1;
    setFeedback(null);
  };

  useEffect(() => {
    if (!feedback || feedback.inputKey !== inputKey) return;
    const timer = window.setTimeout(() => {
      if (
        !mountedRef.current ||
        owner.current.nextId !== feedback.id ||
        owner.current.revision !== feedback.revision
      )
        return;
      setFeedback((current) => (current?.id === feedback.id ? null : current));
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [feedback, inputKey, mountedRef]);

  const visible = feedback?.inputKey === inputKey ? feedback : null;
  const state: State | "idle" = visible?.state ?? "idle";
  return {
    begin,
    finish,
    resetFeedback,
    pending,
    state,
    message: visible?.message ?? "",
  };
}
