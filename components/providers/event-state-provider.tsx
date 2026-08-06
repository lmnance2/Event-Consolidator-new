"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { FREE_SAVE_LIMIT } from "@/lib/subscription/constants";

interface EventStateContextValue {
  savedIds: Set<string>;
  goingIds: Set<string>;
  savedCount: number;
  isLoading: boolean;
  isPro: boolean;
  toggleSave: (id: string) => Promise<{ success: boolean }>;
  toggleGoing: (id: string) => void;
  showLimitDialog: boolean;
  setShowLimitDialog: (open: boolean) => void;
  isSavePending: (id: string) => boolean;
  isGoingPending: (id: string) => boolean;
}

const EventStateContext = createContext<EventStateContextValue | null>(null);

export function useEventState(): EventStateContextValue {
  const ctx = useContext(EventStateContext);
  if (!ctx) {
    throw new Error("useEventState must be used inside EventStateProvider");
  }
  return ctx;
}

interface EventStateResponse {
  saved: string[];
  going: string[];
  isPro: boolean;
}

interface SaveErrorResponse {
  error: string;
}

export function EventStateProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [goingIds, setGoingIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);

  // Promote to state so components re-render when in-flight status changes.
  const [saveInflight, setSaveInflight] = useState<Set<string>>(new Set());
  const [goingInflight, setGoingInflight] = useState<Set<string>>(new Set());

  // Ref mirrors for synchronous guard reads inside callbacks (avoids stale closures).
  const saveInflightRef = useRef<Set<string>>(new Set());
  const goingInflightRef = useRef<Set<string>>(new Set());

  const savedCount = savedIds.size;

  useEffect(() => {
    let cancelled = false;

    fetch("/api/users/me/event-state")
      .then(async (res) => {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as EventStateResponse;
        if (cancelled) return;
        setSavedIds(new Set(data.saved));
        setGoingIds(new Set(data.going));
        setIsPro(data.isPro);
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const toggleSave = useCallback(
    (id: string): Promise<{ success: boolean }> => {
      if (saveInflightRef.current.has(id)) return Promise.resolve({ success: false });

      const wasSaved = savedIds.has(id);

      if (!wasSaved && !isPro && savedIds.size >= FREE_SAVE_LIMIT) {
        setShowLimitDialog(true);
        return Promise.resolve({ success: false });
      }

      saveInflightRef.current.add(id);
      setSaveInflight((prev) => new Set([...prev, id]));

      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(id);
        else next.add(id);
        return next;
      });

      const method = wasSaved ? "DELETE" : "POST";

      return fetch(`/api/events/${id}/save`, { method })
        .then(async (res) => {
          if (res.status === 409) {
            const body = (await res.json()) as SaveErrorResponse;
            if (body.error === "SAVE_LIMIT_REACHED") {
              setSavedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
              setShowLimitDialog(true);
            }
            return { success: false };
          }
          if (!res.ok) {
            setSavedIds((prev) => {
              const next = new Set(prev);
              if (wasSaved) next.add(id);
              else next.delete(id);
              return next;
            });
            return { success: false };
          }
          return { success: true };
        })
        .catch(() => {
          setSavedIds((prev) => {
            const next = new Set(prev);
            if (wasSaved) next.add(id);
            else next.delete(id);
            return next;
          });
          return { success: false };
        })
        .finally(() => {
          saveInflightRef.current.delete(id);
          setSaveInflight((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        });
    },
    [savedIds, isPro]
  );

  const toggleGoing = useCallback(
    (id: string) => {
      if (goingInflightRef.current.has(id)) return;

      const wasGoing = goingIds.has(id);
      goingInflightRef.current.add(id);
      setGoingInflight((prev) => new Set([...prev, id]));

      setGoingIds((prev) => {
        const next = new Set(prev);
        if (wasGoing) next.delete(id);
        else next.add(id);
        return next;
      });

      const method = wasGoing ? "DELETE" : "POST";

      fetch(`/api/events/${id}/going`, { method })
        .then(async (res) => {
          if (!res.ok) {
            setGoingIds((prev) => {
              const next = new Set(prev);
              if (wasGoing) next.add(id);
              else next.delete(id);
              return next;
            });
          }
        })
        .catch(() => {
          setGoingIds((prev) => {
            const next = new Set(prev);
            if (wasGoing) next.add(id);
            else next.delete(id);
            return next;
          });
        })
        .finally(() => {
          goingInflightRef.current.delete(id);
          setGoingInflight((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        });
    },
    [goingIds]
  );

  const isSavePending = useCallback(
    (id: string) => saveInflight.has(id),
    [saveInflight]
  );

  const isGoingPending = useCallback(
    (id: string) => goingInflight.has(id),
    [goingInflight]
  );

  return (
    <EventStateContext.Provider
      value={{
        savedIds,
        goingIds,
        savedCount,
        isLoading,
        isPro,
        toggleSave,
        toggleGoing,
        showLimitDialog,
        setShowLimitDialog,
        isSavePending,
        isGoingPending,
      }}
    >
      {children}
    </EventStateContext.Provider>
  );
}
