// Per-sport player statistics. Each sport has its own stat keys instead of
// one shared schema: cricket counts runs and wickets, football goals and
// cards. A Sport document can override these with its own statDefinitions;
// these are the defaults for the launch sports (and the fallback for any
// sport without definitions).
export interface StatDefinition {
  key: string;
  label: string;
}

export const DEFAULT_STAT_DEFINITIONS: Record<string, StatDefinition[]> = {
  cricket: [
    { key: "runs", label: "Runs" },
    { key: "balls_faced", label: "Balls faced" },
    { key: "fours", label: "Fours" },
    { key: "sixes", label: "Sixes" },
    { key: "dismissed", label: "Times out" },
    { key: "wickets", label: "Wickets" },
    { key: "overs_bowled", label: "Overs bowled" },
    { key: "runs_conceded", label: "Runs conceded" },
    { key: "catches", label: "Catches" },
  ],
  football: [
    { key: "goals", label: "Goals" },
    { key: "assists", label: "Assists" },
    { key: "clean_sheets", label: "Clean sheets" },
    { key: "saves", label: "Saves" },
    { key: "yellow_cards", label: "Yellow cards" },
    { key: "red_cards", label: "Red cards" },
  ],
  futsal: [
    { key: "goals", label: "Goals" },
    { key: "assists", label: "Assists" },
    { key: "saves", label: "Saves" },
    { key: "yellow_cards", label: "Yellow cards" },
    { key: "red_cards", label: "Red cards" },
  ],
  hockey: [
    { key: "goals", label: "Goals" },
    { key: "assists", label: "Assists" },
    { key: "saves", label: "Saves" },
    { key: "green_cards", label: "Green cards" },
    { key: "yellow_cards", label: "Yellow cards" },
  ],
  basketball: [
    { key: "points", label: "Points" },
    { key: "rebounds", label: "Rebounds" },
    { key: "assists", label: "Assists" },
    { key: "steals", label: "Steals" },
    { key: "blocks", label: "Blocks" },
  ],
  volleyball: [
    { key: "points", label: "Points" },
    { key: "aces", label: "Aces" },
    { key: "blocks", label: "Blocks" },
    { key: "digs", label: "Digs" },
  ],
  kabaddi: [
    { key: "raid_points", label: "Raid points" },
    { key: "tackle_points", label: "Tackle points" },
    { key: "bonus_points", label: "Bonus points" },
    { key: "super_raids", label: "Super raids" },
  ],
  badminton: [
    { key: "games_won", label: "Games won" },
    { key: "games_lost", label: "Games lost" },
    { key: "points_won", label: "Points won" },
  ],
  tennis: [
    { key: "sets_won", label: "Sets won" },
    { key: "sets_lost", label: "Sets lost" },
    { key: "aces", label: "Aces" },
    { key: "double_faults", label: "Double faults" },
  ],
  "table-tennis": [
    { key: "games_won", label: "Games won" },
    { key: "games_lost", label: "Games lost" },
    { key: "points_won", label: "Points won" },
  ],
};

export function statDefinitionsFor(sport: string, override?: StatDefinition[] | null): StatDefinition[] {
  if (override && override.length) return override;
  return DEFAULT_STAT_DEFINITIONS[sport] ?? [];
}

const ratio = (a: number, b: number, scale = 1) => (b > 0 ? Math.round((a / b) * scale * 100) / 100 : null);

/** Figures computed from totals when shown (never stored, so they can't drift). */
export function derivedStats(sport: string, totals: Record<string, number>, matches: number): Record<string, number | null> {
  const t = (k: string) => totals[k] ?? 0;
  switch (sport) {
    case "cricket":
      return {
        batting_average: ratio(t("runs"), t("dismissed")),
        strike_rate: ratio(t("runs"), t("balls_faced"), 100),
        economy: ratio(t("runs_conceded"), t("overs_bowled")),
      };
    case "football":
    case "futsal":
    case "hockey":
      return { goals_per_match: ratio(t("goals"), matches) };
    case "basketball":
      return { points_per_game: ratio(t("points"), matches), rebounds_per_game: ratio(t("rebounds"), matches) };
    case "kabaddi":
      return { points_per_match: ratio(t("raid_points") + t("tackle_points") + t("bonus_points"), matches) };
    default:
      return {};
  }
}
