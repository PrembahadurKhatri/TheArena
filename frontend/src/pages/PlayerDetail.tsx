import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Crown, Mail, Phone, User } from "lucide-react";
import api from "@/api/axios";
import type { PlayerProfile } from "@/types";
import { apiError } from "@/types";
import { getSportBySlug } from "@/data/sports";
import Reveal from "@/components/Reveal";
import { Loading, ErrorState } from "@/components/ui/StateBlock";

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

  if (loading) return <Loading label="Loading player..." />;
  if (error || !player) return <ErrorState message={error || "Player not found."} />;

  return (
    <main className="flex-1 py-16">
      <div className="container-x max-w-2xl">
        <Reveal>
          <div className="glass flex flex-col items-center gap-4 rounded-3xl p-10 text-center">
            {player.photo ? (
              <img src={player.photo} alt={player.name} className="h-24 w-24 rounded-full object-cover" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent-soft text-accent">
                <User className="h-9 w-9" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <h1 className="font-display text-3xl font-bold text-ink">{player.name}</h1>
              {player.isPremium && <Crown className="h-5 w-5 text-premium" />}
            </div>
            {player.isPremium && <span className="eyebrow-premium">Premium Member</span>}

            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              {player.sportPreferences?.length ? (
                player.sportPreferences.map((slug) => {
                  const s = getSportBySlug(slug);
                  return (
                    <span key={slug} className="rounded-full bg-surface-2 px-3 py-1.5 text-xs text-ink-muted">
                      {s?.emoji} {s?.name ?? slug}
                    </span>
                  );
                })
              ) : (
                <p className="text-sm text-ink-faint">No sport preferences listed.</p>
              )}
            </div>

            {(player.email || player.phone) && (
              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 text-sm text-ink-muted">
                {player.email && (
                  <span className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" /> {player.email}
                  </span>
                )}
                {player.phone && (
                  <span className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" /> {player.phone}
                  </span>
                )}
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </main>
  );
}
