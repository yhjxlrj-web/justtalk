import { Capacitor, registerPlugin } from "@capacitor/core";

type JTLogLevel = "debug" | "info" | "warn" | "error";

type JTLoggerPlugin = {
  log(options: {
    level?: JTLogLevel;
    message: string;
    payload?: string;
  }): Promise<{ ok: boolean }>;
};

const JT_LOG_PREFIX = "[JT-REALTIME]";
const JTLogger = registerPlugin<JTLoggerPlugin>("JTLogger");

function stringifyPayload(payload: unknown) {
  if (payload === undefined) {
    return undefined;
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

export function logRealtime(
  message: string,
  payload?: unknown,
  level: JTLogLevel = "info"
) {
  const prefixedMessage = `${JT_LOG_PREFIX} ${message}`;

  const consoleMethod =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : level === "debug"
          ? console.debug
          : console.log;

  if (payload === undefined) {
    consoleMethod(prefixedMessage);
  } else {
    consoleMethod(prefixedMessage, payload);
  }

  if (Capacitor.getPlatform() !== "android") {
    return;
  }

  const payloadString = stringifyPayload(payload);
  void JTLogger.log({
    level,
    message: prefixedMessage,
    payload: payloadString
  }).catch((error) => {
    console.warn(`${JT_LOG_PREFIX} native log bridge failed`, error);
  });
}
