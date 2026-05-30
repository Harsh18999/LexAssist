import { useEffect, useState } from "react";

const BACKEND_URL = "https://lexassist-1.onrender.com/";
const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 40; // ~2 min

/**
 * WakeUpLoader — pings the Render backend until it wakes up.
 * Renders a beautiful full-screen loader while the backend is sleeping,
 * then renders children once the server responds with JSON.
 */
export default function WakeUpLoader({ children }) {
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    let elapsedTimer = null;
    let tries = 0;
    const start = Date.now();

    // Tick elapsed seconds so the UI stays alive
    elapsedTimer = setInterval(() => {
      if (!cancelled) setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    async function ping() {
      if (cancelled) return;
      tries++;
      setAttempt(tries);

      if (tries > MAX_ATTEMPTS) {
        setFailed(true);
        clearInterval(elapsedTimer);
        return;
      }

      try {
        const res = await fetch(BACKEND_URL, {
          method: "GET",
          // Short timeout so we don't hang too long
          signal: AbortSignal.timeout(8000),
        });
        const data = await res.json();
        if (data && !cancelled) {
          clearInterval(elapsedTimer);
          setReady(true);
          return;
        }
      } catch {
        // Server is still sleeping — try again
      }

      if (!cancelled) {
        timer = setTimeout(ping, POLL_INTERVAL_MS);
      }
    }

    ping();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(elapsedTimer);
    };
  }, []);

  if (ready) return children;

  if (failed) {
    return (
      <div className="wakeup-screen">
        <div className="wakeup-card">
          <div className="wakeup-icon wakeup-icon--error">⚠️</div>
          <h2 className="wakeup-title">Server Unreachable</h2>
          <p className="wakeup-subtitle">
            The backend did not respond after {Math.round(MAX_ATTEMPTS * POLL_INTERVAL_MS / 1000)}s.
            Please try refreshing the page.
          </p>
          <button
            className="btn btn-primary"
            style={{ marginTop: "1.5rem" }}
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  const dots = ".".repeat((elapsed % 3) + 1).padEnd(3, "\u00a0");

  return (
    <div className="wakeup-screen">
      <div className="wakeup-card">
        {/* Animated logo / icon */}
        <div className="wakeup-logo">
          <div className="wakeup-rings">
            <span className="wakeup-ring wakeup-ring--1" />
            <span className="wakeup-ring wakeup-ring--2" />
            <span className="wakeup-ring wakeup-ring--3" />
          </div>
          <span className="wakeup-logo-text">⚖️</span>
        </div>

        <h2 className="wakeup-title">Starting JurisAI</h2>
        <p className="wakeup-subtitle">
          The server is waking up from sleep{dots}
        </p>

        {/* Progress bar that grows based on elapsed vs expected */}
        <div className="wakeup-bar-wrap">
          <div
            className="wakeup-bar"
            style={{
              width: `${Math.min(95, (attempt / MAX_ATTEMPTS) * 100)}%`,
            }}
          />
        </div>

        <p className="wakeup-hint">
          {elapsed < 5
            ? "Connecting to backend…"
            : elapsed < 20
            ? "This may take up to 30 seconds on cold start."
            : "Almost there — Render free tier needs a moment to spin up."}
        </p>

        <div className="wakeup-elapsed">{elapsed}s elapsed</div>
      </div>
    </div>
  );
}
