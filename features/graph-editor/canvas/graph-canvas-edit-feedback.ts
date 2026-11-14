"use client";

import { useCallback, useEffect, useState } from "react";

import type { NodeId } from "../core/graph/model";

export type EditFeedback = {
  id: number;
  nodeIds: NodeId[];
};

export function useEditFeedback() {
  const [editFeedback, setEditFeedback] = useState<EditFeedback | null>(null);

  useEffect(() => {
    if (!editFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setEditFeedback(null);
    }, 560);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [editFeedback]);

  const showEditFeedback = useCallback((nodeIds: NodeId[]) => {
    if (nodeIds.length === 0) {
      return;
    }

    setEditFeedback((current) => ({
      id: (current?.id ?? 0) + 1,
      nodeIds,
    }));
  }, []);

  return { editFeedback, showEditFeedback };
}
