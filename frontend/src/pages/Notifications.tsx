import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Megaphone } from "lucide-react";
import api from "@/api/axios";
import { useApi } from "@/hooks/useApi";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import Button from "@/components/ui/Button";
import { NOTIFICATIONS_CHANGED } from "@/components/NotificationBell";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
  actor: { id: string; name: string } | null;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
}

export function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Notifications() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi<{ notifications: NotificationRow[]; unread: number; pages: number }>("/notifications", {
    unread: filter === "unread" ? "true" : undefined,
    page,
  });
  const ann = useApi<{ announcements: Announcement[] }>("/meta/announcements");
  const navigate = useNavigate();

  async function open(n: NotificationRow) {
    if (!n.read) {
      await api.post(`/notifications/${n.id}/read`).catch(() => undefined);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    }
    if (n.link) navigate(n.link);
    else reload();
  }

  async function readAll() {
    await api.post("/notifications/read-all");
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    reload();
  }

  return (
    <main className="flex-1">
      <section className="border-b border-border bg-base-2">
        <div className="container-x flex flex-wrap items-end justify-between gap-4 py-10 md:py-14">
          <div>
            <h1 className="font-display text-4xl font-bold text-ink md:text-5xl">Notifications</h1>
            <p className="mt-2 text-ink-muted">{data ? `${data.unread} unread` : " "}</p>
          </div>
          <Button variant="secondary" size="sm" icon={<CheckCheck className="h-4 w-4" />} onClick={readAll} disabled={!data?.unread}>
            Mark all as read
          </Button>
        </div>
      </section>

      <div className="container-x grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <div className="mb-5 flex gap-2" role="tablist">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                onClick={() => {
                  setFilter(f);
                  setPage(1);
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold ${filter === f ? "bg-accent text-white" : "bg-surface text-ink-muted hover:text-ink"}`}
              >
                {f === "all" ? "All" : "Unread"}
              </button>
            ))}
          </div>
          {loading && <Loading label="Loading notifications…" />}
          {!loading && error && <ErrorState message={error} onRetry={reload} />}
          {!loading && !error && data?.notifications.length === 0 && (
            <EmptyState
              icon={<Bell className="h-5 w-5" />}
              title="You’re all caught up"
              message="Invitations, challenges, results and order updates will show up here."
            />
          )}
          {!loading && !error && !!data?.notifications.length && (
            <ul className="panel divide-y divide-border overflow-hidden">
              {data.notifications.map((n) => (
                <li key={n.id}>
                  <button onClick={() => open(n)} className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-surface-2">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-accent"}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className={`block ${n.read ? "text-ink-muted" : "font-semibold text-ink"}`}>{n.title}</span>
                      {n.body && <span className="mt-0.5 block text-sm text-ink-faint">{n.body}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-ink-faint">{timeAgo(n.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {data && data.pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Newer
              </Button>
              <span className="num text-sm text-ink-faint">
                {page} / {data.pages}
              </span>
              <Button variant="secondary" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                Older
              </Button>
            </div>
          )}
        </section>

        <aside>
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
            <Megaphone className="h-4 w-4 text-premium" /> Announcements
          </h2>
          {ann.data?.announcements.length ? (
            <ul className="mt-4 flex flex-col gap-3">
              {ann.data.announcements.map((a) => (
                <li key={a.id} className="panel p-4">
                  <p className="font-semibold text-ink">{a.title}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-muted">{a.body}</p>
                  <p className="mt-2 text-xs text-ink-faint">{new Date(a.publishedAt).toLocaleDateString()}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-faint">No announcements right now.</p>
          )}
          <p className="mt-6 text-xs text-ink-faint">
            Control what others can see in{" "}
            <Link to="/settings?tab=privacy" className="text-accent hover:underline">
              privacy settings
            </Link>
            .
          </p>
        </aside>
      </div>
    </main>
  );
}
