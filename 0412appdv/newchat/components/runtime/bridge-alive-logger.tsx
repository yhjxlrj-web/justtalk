"use client";

import { useEffect } from "react";
import { logRealtime } from "@/lib/logging/realtime-log";

export function BridgeAliveLogger() {
  useEffect(() => {
    logRealtime("bridge alive", {
      source: "web-runtime-mounted"
    });
  }, []);

  return null;
}
