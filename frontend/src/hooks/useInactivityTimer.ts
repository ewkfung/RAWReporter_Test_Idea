import React from "react";
import { useAuthStore } from "../store/authStore";

const INACTIVITY_MS = 55 * 60 * 1000; // 55 minutes → show warning
const WARNING_SECONDS = 5 * 60;        // 5-minute countdown before logout

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
] as const;

interface InactivityTimerResult {
  showWarning: boolean;
  secondsLeft: number;
  onStayActive: () => void;
}

export function useInactivityTimer(): InactivityTimerResult {
  const [showWarning, setShowWarning] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(WARNING_SECONDS);

  const inactivityTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  // Track warning state in a ref to avoid stale closure in activity handler
  const showWarningRef = React.useRef(false);

  const clearCountdown = () => {
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const startCountdown = () => {
    setSecondsLeft(WARNING_SECONDS);
    let remaining = WARNING_SECONDS;

    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearCountdown();
        useAuthStore.getState().logout();
      }
    }, 1000);
  };

  const startInactivityTimer = React.useCallback(() => {
    if (inactivityTimerRef.current !== null) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      showWarningRef.current = true;
      setShowWarning(true);
      startCountdown();
    }, INACTIVITY_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onStayActive = React.useCallback(() => {
    showWarningRef.current = false;
    setShowWarning(false);
    setSecondsLeft(WARNING_SECONDS);
    clearCountdown();
    startInactivityTimer();
  }, [startInactivityTimer]);

  React.useEffect(() => {
    startInactivityTimer();

    const handleActivity = () => {
      // Only reset if the warning is not showing (don't reset during countdown)
      if (!showWarningRef.current) {
        startInactivityTimer();
      }
    };

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      if (inactivityTimerRef.current !== null) {
        clearTimeout(inactivityTimerRef.current);
      }
      clearCountdown();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [startInactivityTimer]);

  return { showWarning, secondsLeft, onStayActive };
}
