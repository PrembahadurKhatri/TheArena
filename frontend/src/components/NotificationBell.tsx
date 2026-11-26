import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";

export const NOTIFICATIONS_CHANGED = "arena:notifications-changed";

// Polls the unread count once a minute (and on navigation), so it needs no
// websocket and works on hosts that sleep.
export default function NotificationBell() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () =>
      api
        .get("/notifications/unread-count")
        .then(({ data }) => alive && setUnread(data.unread ?? 0))
        .catch(() => undefined);
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener(NOTIFICATIONS_CHANGED, load);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener(NOTIFICATIONS_CHANGED, load);
    };
  }, [user, location.pathname]);

  if (!user) return null;
  return (
    <Link
      to="/notifications"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface/80 text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
    >
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span className="num absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
