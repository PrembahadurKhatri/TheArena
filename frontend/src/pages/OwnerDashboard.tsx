import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarClock, Plus, Warehouse } from "lucide-react";
import api from "@/api/axios";
import { compressImage } from "@/api/images";
import { apiError } from "@/types";
import { useApi } from "@/hooks/useApi";
import { SPORTS } from "@/data/sports";
import { PROVINCES } from "@/data/provinces";
import { districtOptions } from "@/data/locations";
import { Loading, EmptyState } from "@/components/ui/StateBlock";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/Badge";
import { FormError } from "@/components/page/AuthShell";

interface OwnedGround {
  id: string;
  name: string;
  slug: string | null;
  sports: string[];
  location: string;
  address: string | null;
  province: string | null;
  district: string | null;
  municipality: string | null;
  pricePerHour: number;
  description: string | null;
  amenities: string[];
  openingHours: { closed: boolean; open: string; close: string }[];
  slotMinutes: number;
  contactPhone: string | null;
  status: string;
  review: { note: string | null } | null;
}

interface OwnerBooking {
  id: string;
  ground: { id: string; name: string } | null;
  date: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  source: string;
  note: string | null;
  bookedBy?: { name: string; phone: string | null };
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_HOURS = DAYS.map(() => ({ closed: false, open: "06:00", close: "21:00" }));

function GroundForm({ ground, onDone }: { ground?: OwnedGround; onDone: () => void }) {
  const [form, setForm] = useState({
    name: ground?.name ?? "",
    location: ground?.location ?? "",
    address: ground?.address ?? "",
    province: ground?.province ?? "",
    district: ground?.district ?? "",
    municipality: ground?.municipality ?? "",
    pricePerHour: String(ground?.pricePerHour ?? ""),
    description: ground?.description ?? "",
    amenities: (ground?.amenities ?? []).join(", "),
    contactPhone: ground?.contactPhone ?? "",
    slotMinutes: String(ground?.slotMinutes ?? 60),
  });
  const [sports, setSports] = useState<string[]>(ground?.sports ?? []);
  const [hours, setHours] = useState(ground?.openingHours?.length ? ground.openingHours : DEFAULT_HOURS);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function useLocation(body: FormData) {
    return new Promise<void>((resolve) => {
      if (!navigator.geolocation || ground) return resolve();
      navigator.geolocation.getCurrentPosition(
        (p) => {
          body.append("lat", String(p.coords.latitude));
          body.append("lng", String(p.coords.longitude));
          resolve();
        },
        () => resolve(),
        { timeout: 5000 }
      );
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      for (const [k, v] of Object.entries(form)) body.append(k, v);
      body.append("sports", JSON.stringify(sports));
      body.append("amenities", JSON.stringify(form.amenities.split(",").map((a) => a.trim()).filter(Boolean)));
      body.append("openingHours", JSON.stringify(hours));
      for (const f of files) body.append("images", await compressImage(f));
      await useLocation(body);
      if (ground) await api.patch(`/owner/grounds/${ground.id}`, body);
      else await api.post("/owner/grounds", body);
      onDone();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel flex flex-col gap-5 p-6">
      <h2 className="font-display text-2xl font-bold text-ink">{ground ? `Edit ${ground.name}` : "List a ground"}</h2>
      {!ground && <p className="text-sm text-ink-muted">The Arena reviews new listings before they appear in search. We’ll use your current location as the map pin if you allow it.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="gname" label="Ground name" required value={form.name} onChange={(e) => set("name")(e.target.value)} maxLength={80} />
        <Input id="gprice" label="Price per hour (NPR)" type="number" min={0} required value={form.pricePerHour} onChange={(e) => set("pricePerHour")(e.target.value)} />
        <Input id="gloc" label="Area" required value={form.location} onChange={(e) => set("location")(e.target.value)} placeholder="e.g. Lakeside, Pokhara" />
        <Input id="gaddr" label="Street address" value={form.address} onChange={(e) => set("address")(e.target.value)} />
        <Select id="gprov" label="Province" value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value, district: "" }))}>
          <option value="">Not set</option>
          {PROVINCES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Select>
        <Select id="gdist" label="District" value={form.district} onChange={(e) => set("district")(e.target.value)}>
          <option value="">Not set</option>
          {districtOptions(form.province || undefined).map((d) => (
            <option key={d.value}>{d.value}</option>
          ))}
        </Select>
        <Input id="gmun" label="Municipality" value={form.municipality} onChange={(e) => set("municipality")(e.target.value)} />
        <Input id="gphone" label="Contact phone" value={form.contactPhone} onChange={(e) => set("contactPhone")(e.target.value)} />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-muted">Sports played here</legend>
        <div className="flex flex-wrap gap-2">
          {SPORTS.map((s) => (
            <label key={s.slug} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${sports.includes(s.slug) ? "border-accent bg-accent-soft text-accent" : "border-border text-ink-muted"}`}>
              <input type="checkbox" className="sr-only" checked={sports.includes(s.slug)} onChange={(e) => setSports((cur) => (e.target.checked ? [...cur, s.slug] : cur.filter((x) => x !== s.slug)))} />
              {s.name}
            </label>
          ))}
        </div>
      </fieldset>
      <Textarea id="gdesc" label="Description" maxLength={2000} value={form.description} onChange={(e) => set("description")(e.target.value)} />
      <Input id="gam" label="Facilities (comma separated)" value={form.amenities} onChange={(e) => set("amenities")(e.target.value)} placeholder="Floodlights, Changing rooms, Parking" />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-muted">Opening hours</legend>
        <div className="grid gap-2">
          {hours.map((d, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="w-24 text-ink">{DAYS[i]}</span>
              <label className="flex items-center gap-1.5 text-ink-muted">
                <input type="checkbox" checked={d.closed} onChange={(e) => setHours((h) => h.map((x, k) => (k === i ? { ...x, closed: e.target.checked } : x)))} /> Closed
              </label>
              {!d.closed && (
                <>
                  <input type="time" className="h-9 rounded-lg border border-border bg-base-2 px-2" value={d.open} onChange={(e) => setHours((h) => h.map((x, k) => (k === i ? { ...x, open: e.target.value } : x)))} aria-label={`${DAYS[i]} opens`} />
                  <span className="text-ink-faint">to</span>
                  <input type="time" className="h-9 rounded-lg border border-border bg-base-2 px-2" value={d.close} onChange={(e) => setHours((h) => h.map((x, k) => (k === i ? { ...x, close: e.target.value } : x)))} aria-label={`${DAYS[i]} closes`} />
                </>
              )}
            </div>
          ))}
        </div>
      </fieldset>
      <Select id="gslot" label="Booking slot length" value={form.slotMinutes} onChange={(e) => set("slotMinutes")(e.target.value)}>
        {[30, 60, 90, 120].map((m) => (
          <option key={m} value={m}>
            {m} minutes
          </option>
        ))}
      </Select>
      <label className="flex flex-col gap-2 text-sm text-ink-muted">
        Photos (up to 8)
        <input type="file" accept="image/*" multiple onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 8))} />
      </label>
      {error && <FormError>{error}</FormError>}
      <div className="flex gap-2">
        <Button type="submit" loading={busy} disabled={!sports.length}>
          {ground ? "Save changes" : "Submit for review"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Bookings({ grounds }: { grounds: OwnedGround[] }) {
  const [filter, setFilter] = useState({ groundId: "", date: "" });
  const list = useApi<{ bookings: OwnerBooking[] }>("/owner/bookings", filter);
  const [error, setError] = useState("");
  const [block, setBlock] = useState({ groundId: grounds[0]?.id ?? "", date: "", startTime: "", endTime: "", note: "" });

  async function act(b: OwnerBooking, action: string) {
    const reason = action === "cancel" && b.status !== "blocked" ? window.prompt("Reason for cancelling (sent to the booker):") : "";
    if (action === "cancel" && b.status !== "blocked" && !reason) return;
    setError("");
    try {
      await api.post(`/owner/bookings/${b.id}/action`, { action, reason });
      list.reload();
    } catch (err) {
      setError(apiError(err));
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section>
        <div className="flex flex-wrap gap-2">
          <select className="h-10 rounded-full border border-border bg-surface px-3 text-sm" value={filter.groundId} onChange={(e) => setFilter({ ...filter, groundId: e.target.value })} aria-label="Ground">
            <option value="">All grounds</option>
            {grounds.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <input type="date" className="h-10 rounded-full border border-border bg-surface px-3 text-sm" value={filter.date} onChange={(e) => setFilter({ ...filter, date: e.target.value })} aria-label="Date" />
        </div>
        {error && (
          <div className="mt-4">
            <FormError>{error}</FormError>
          </div>
        )}
        {list.loading ? (
          <Loading />
        ) : !list.data?.bookings.length ? (
          <p className="mt-6 text-sm text-ink-faint">No upcoming bookings.</p>
        ) : (
          <ul className="panel mt-6 divide-y divide-border">
            {list.data.bookings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="num w-28 shrink-0 text-sm">
                  <span className="block font-semibold text-ink">{b.date}</span>
                  <span className="text-ink-faint">
                    {b.startTime}–{b.endTime}
                  </span>
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-semibold text-ink">{b.status === "blocked" ? `Blocked${b.note ? `: ${b.note}` : ""}` : b.bookedBy?.name ?? "Booking"}</span>
                  <span className="block text-ink-faint">
                    {b.ground?.name}
                    {b.bookedBy?.phone ? ` · ${b.bookedBy.phone}` : ""}
                    {b.status !== "blocked" ? ` · Rs ${b.totalAmount} ${b.paymentMethod === "pay_at_venue" ? "at the venue" : "online"}` : ""}
                    {b.source === "challenge" ? " · match" : ""}
                  </span>
                </span>
                <StatusBadge status={b.status} />
                <span className="flex gap-1">
                  {b.status === "confirmed_unpaid" && (
                    <Button size="sm" onClick={() => act(b, "mark_paid")}>
                      Paid
                    </Button>
                  )}
                  {(b.status === "confirmed" || b.status === "confirmed_unpaid") && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => act(b, "complete")}>
                        Played
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => act(b, "no_show")}>
                        No-show
                      </Button>
                    </>
                  )}
                  {["pending_payment", "confirmed", "confirmed_unpaid", "blocked"].includes(b.status) && (
                    <Button size="sm" variant="ghost" onClick={() => act(b, "cancel")}>
                      {b.status === "blocked" ? "Unblock" : "Cancel"}
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <form
        className="panel flex flex-col gap-3 self-start p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await api.post(`/owner/grounds/${block.groundId}/blocks`, block);
            setBlock({ ...block, startTime: "", endTime: "", note: "" });
            list.reload();
          } catch (err) {
            setError(apiError(err));
          }
        }}
      >
        <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
          <CalendarClock className="h-5 w-5" /> Block a slot
        </h3>
        <select className="h-10 rounded-lg border border-border bg-base-2 px-3 text-sm" value={block.groundId} onChange={(e) => setBlock({ ...block, groundId: e.target.value })} aria-label="Ground">
          {grounds.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <input type="date" required className="h-10 rounded-lg border border-border bg-base-2 px-3 text-sm" value={block.date} onChange={(e) => setBlock({ ...block, date: e.target.value })} aria-label="Date" />
        <div className="grid grid-cols-2 gap-2">
          <input type="time" required className="h-10 rounded-lg border border-border bg-base-2 px-3 text-sm" value={block.startTime} onChange={(e) => setBlock({ ...block, startTime: e.target.value })} aria-label="From" />
          <input type="time" required className="h-10 rounded-lg border border-border bg-base-2 px-3 text-sm" value={block.endTime} onChange={(e) => setBlock({ ...block, endTime: e.target.value })} aria-label="To" />
        </div>
        <input className="h-10 rounded-lg border border-border bg-base-2 px-3 text-sm" placeholder="Note (e.g. maintenance)" value={block.note} onChange={(e) => setBlock({ ...block, note: e.target.value })} />
        <Button type="submit" size="sm" disabled={!block.groundId}>
          Block
        </Button>
      </form>
    </div>
  );
}

export default function OwnerDashboard() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "bookings" ? "bookings" : "grounds";
  const list = useApi<{ grounds: OwnedGround[] }>("/owner/grounds");
  const [editing, setEditing] = useState<OwnedGround | "new" | null>(null);
  const grounds = list.data?.grounds ?? [];

  return (
    <main className="flex-1">
      <section className="border-b border-border bg-base-2">
        <div className="container-x flex flex-wrap items-end justify-between gap-4 py-10 md:py-14">
          <div>
            <h1 className="font-display text-4xl font-bold text-ink md:text-5xl">Ground owner</h1>
            <p className="mt-2 text-ink-muted">Your grounds, bookings and availability.</p>
          </div>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing("new")}>
            List a ground
          </Button>
        </div>
      </section>
      <div className="container-x py-10">
        <nav className="mb-8 flex gap-1 border-b border-border">
          {(["grounds", "bookings"] as const).map((t) => (
            <button key={t} onClick={() => setParams({ tab: t })} className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold ${tab === t ? "border-accent text-ink" : "border-transparent text-ink-muted"}`}>
              {t === "grounds" ? "My grounds" : "Bookings"}
            </button>
          ))}
        </nav>

        {editing && (
          <div className="mb-10">
            <GroundForm
              ground={editing === "new" ? undefined : editing}
              onDone={() => {
                setEditing(null);
                list.reload();
              }}
            />
          </div>
        )}

        {list.loading ? (
          <Loading />
        ) : grounds.length === 0 && !editing ? (
          <EmptyState icon={<Warehouse className="h-5 w-5" />} title="No grounds yet" message="List your futsal court, cricket ground or badminton hall and take bookings on The Arena." />
        ) : tab === "grounds" ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {grounds.map((g) => (
              <li key={g.id} className="panel flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/grounds/${g.slug || g.id}`} className="block truncate font-display text-xl font-bold text-ink hover:text-accent">
                      {g.name}
                    </Link>
                    <p className="text-sm text-ink-faint">
                      {g.location} · Rs {g.pricePerHour}/h
                    </p>
                  </div>
                  <StatusBadge status={g.status} />
                </div>
                {g.status === "rejected" && g.review?.note && <p className="text-sm text-danger">Not approved: {g.review.note}. Edit and save to send it for review again.</p>}
                {g.status === "pending" && <p className="text-sm text-ink-muted">Waiting for The Arena to review it.</p>}
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(g)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setParams({ tab: "bookings" })}>
                    Bookings
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Bookings grounds={grounds} />
        )}
      </div>
    </main>
  );
}
