import { useEffect, useState } from "react";
import ReportButton from "@/components/ReportButton";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Crown, Mail, MapPin, Phone } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import type { PlayerProfile } from "@/types";
import { apiError } from "@/types";
import { getSportBySlug } from "@/data/sports";
import { Loading, ErrorState } from "@/components/ui/StateBlock";
import { Initials } from "@/components/ui/SportMark";
import StatsPanel from "@/components/StatsPanel";

export default function PlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    api
      .get(`/players/${id}`)
      .then(({ data }) => setPlayer(data.player))
      .catch((err) => setError(apiError(err, "Could not load this player.")))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loading label="Loading player…" />;
  if (error || !player) return <ErrorState message={error || "Player not found."} />;

  const sports = player.sportPreferences ?? [];

  return (
    <main className="flex-1">
      <section className="border-b border-border bg-base-2">
        <div className="container-x grid gap-10 py-12 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-end md:py-16">
          <div className="relative aspect-[4/5] w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-surface">
            {player.photo ? (
              <img src={assetUrl(player.photo)} alt={player.name} className="h-full w-full object-cover" />
            ) : (
              <Initials name={player.name} className="h-full w-full bg-surface text-8xl text-ink-faint" />
            )}
          </div>

          <div className="min-w-0">
            <Link to="/players" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
              <ArrowLeft className="h-4 w-4" /> All players
            </Link>
            {player.isPremium && (
              <p className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-premium/30 bg-premium-soft px-3 py-1 text-sm font-semibold text-premium">
                <Crown className="h-3.5 w-3.5" /> Premium member
              </p>
            )}
            <h1 className="mt-4 font-display text-6xl font-bold leading-[0.92] text-ink md:text-8xl">{player.name}</h1>
            {player.username && <p className="mt-3 text-lg text-ink-muted">@{player.username}</p>}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted">
              {(player.municipality || player.district || player.province) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-ink-faint" />
                  {[player.municipality, player.district, player.province].filter(Boolean).join(", ")}
                </span>
              )}
              {player.age != null && <span>{player.age} years old</span>}
              {player.memberSince && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-ink-faint" /> Joined {new Date(player.memberSince).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </span>
              )}
            </div>
            {player.bio && <p className="mt-6 max-w-xl whitespace-pre-line text-ink-muted">{player.bio}</p>}
            <div className="mt-6">
              <ReportButton targetType="user" targetId={player.id} />
            </div>

            {(player.email || player.phone) && (
              <div className="mt-8 flex flex-wrap gap-3">
                {player.email && (
                  <a
                    href={`mailto:${player.email}`}
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm text-ink-muted transition-colors hover:border-ink-faint/60 hover:text-ink active:bg-surface-2"
                  >
                    <Mail className="h-4 w-4" /> {player.email}
                  </a>
                )}
                {player.phone && (
                  <a
                    href={`tel:${player.phone}`}
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm text-ink-muted transition-colors hover:border-ink-faint/60 hover:text-ink active:bg-surface-2"
                  >
                    <Phone className="h-4 w-4" /> {player.phone}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="container-x py-12 md:py-16">
        <h2 className="font-display text-3xl font-bold text-ink">Plays</h2>
        {sports.length ? (
          <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-4">
            {sports.map((slug) => {
              const s = getSportBySlug(slug);
              const profile = player.sportProfiles?.find((p) => p.sport === slug);
              return (
                <li key={slug}>
                  <Link
                    to={`/players?sport=${slug}`}
                    className="panel card-lift relative flex aspect-[16/10] items-end overflow-hidden"
                  >
                    {s?.image && (
                      <img src={s.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-70" />
                    )}
                    <span className="photo-veil-bottom absolute inset-0" />
                    <span className="relative p-4">
                      <span className="block font-display text-2xl font-bold text-ink">{s?.name ?? slug}</span>
                      {(profile?.position || profile?.experienceLevel) && (
                        <span className="mt-1 block text-sm capitalize text-ink-muted">
                          {[profile.position, profile.experienceLevel].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-ink-faint">No sport preferences listed.</p>
        )}
      </section>
      <StatsPanel kind="players" id={player.id} />
    </main>
  );
}
