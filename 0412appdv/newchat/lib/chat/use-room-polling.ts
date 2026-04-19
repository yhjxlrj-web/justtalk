"use client";

import { useEffect, useRef } from "react";

type PollReason = "initial" | "interval" | "visibility";

export function useRoomPolling(params: {
  enabled: boolean;
  intervalMs?: number;
  roomId: string;
  onPoll: (reason: PollReason) => Promise<void>;
}) {
  const { enabled, intervalMs = 2500, roomId, onPoll } = params;
  const pollInFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isDisposed = false;

    const runPoll = async (reason: PollReason) => {
      if (pollInFlightRef.current || isDisposed) {
        return;
      }

      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      pollInFlightRef.current = true;

      try {
        await onPoll(reason);
      } finally {
        pollInFlightRef.current = false;
      }
    };

    console.log("[chat-room] polling started", { roomId, intervalMs });
    void runPoll("initial");

    const intervalHandle = window.setInterval(() => {
      void runPoll("interval");
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runPoll("visibility");
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      isDisposed = true;
      window.clearInterval(intervalHandle);

      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }

      console.log("[chat-room] polling stopped", { roomId });
    };
  }, [enabled, intervalMs, onPoll, roomId]);
}
