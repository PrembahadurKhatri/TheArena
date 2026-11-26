// Pure fixture generators for every tournament format. They work on team
// ids (strings) and return plain fixture specs; tournamentsService turns them
// into Match documents. No database access here, so each format is unit
// tested directly (tests/fixtures.test.ts).

export interface FixtureSpec {
  key: string; // unique within one generation, used to link knockout rounds
  stage: "knockout" | "league" | "group";
  round: number;
  group: string | null;
  matchNumber: number;
  teamA: string | null;
  teamB: string | null;
  nextKey: string | null;
  nextSlot: "A" | "B" | null;
}

export const nextPow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(2, n)));

/**
 * Standard bracket seed order, so seed 1 and seed 2 can only meet in the
 * final: 4 -> [1,4,2,3], 8 -> [1,8,4,5,2,7,3,6].
 */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

/**
 * Single-elimination bracket for teams in seed order. Padded to a power of
 * two; the missing slots are byes, which fall only in round 1 and go to the
 * top seeds. Every round is created up front and linked through nextKey, so
 * a verified winner just drops into their next match.
 */
export function knockout(seeded: string[], keyPrefix = "ko"): FixtureSpec[] {
  const size = nextPow2(seeded.length);
  const rounds = Math.log2(size);
  const order = seedOrder(size);
  const out: FixtureSpec[] = [];
  let number = 1;
  for (let r = 1; r <= rounds; r++) {
    const count = size / 2 ** r;
    for (let j = 0; j < count; j++) {
      const isLast = r === rounds;
      out.push({
        key: `${keyPrefix}-r${r}-m${j}`,
        stage: "knockout",
        round: r,
        group: null,
        matchNumber: number++,
        teamA: r === 1 ? seeded[order[2 * j] - 1] ?? null : null,
        teamB: r === 1 ? seeded[order[2 * j + 1] - 1] ?? null : null,
        nextKey: isLast ? null : `${keyPrefix}-r${r + 1}-m${Math.floor(j / 2)}`,
        nextSlot: isLast ? null : j % 2 === 0 ? "A" : "B",
      });
    }
  }
  return out;
}

/**
 * Round robin by the circle method: every team plays every other team once
 * per leg (legs = 2 for a home-and-away league). With an odd number of teams
 * one team rests each round.
 */
export function roundRobin(teams: string[], legs = 1, group: string | null = null, keyPrefix = "rr", startNumber = 1): FixtureSpec[] {
  const list: (string | null)[] = [...teams];
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const roundsPerLeg = n - 1;
  const out: FixtureSpec[] = [];
  let number = startNumber;
  for (let leg = 0; leg < legs; leg++) {
    const rot = [...list];
    for (let r = 0; r < roundsPerLeg; r++) {
      for (let i = 0; i < n / 2; i++) {
        const home = rot[i];
        const away = rot[n - 1 - i];
        if (home === null || away === null) continue;
        // Alternate home side so nobody is always "A"; swap again in leg 2.
        const swap = (r % 2 === 1) !== (leg === 1);
        out.push({
          key: `${keyPrefix}-${group ?? "all"}-l${leg}-r${r}-m${i}`,
          stage: group ? "group" : "league",
          round: leg * roundsPerLeg + r + 1,
          group,
          matchNumber: number++,
          teamA: swap ? away : home,
          teamB: swap ? home : away,
          nextKey: null,
          nextSlot: null,
        });
      }
      // Rotate everything except the first entry.
      rot.splice(1, 0, rot.pop()!);
    }
  }
  return out;
}

export const groupLabel = (i: number) => String.fromCharCode(65 + i);

/** Snake seeding into groups: 1→A, 2→B, 3→B, 4→A ... so groups stay balanced. */
export function splitIntoGroups(seeded: string[], groups: number): Record<string, string[]> {
  const g = Math.max(1, Math.min(groups, Math.floor(seeded.length / 2) || 1));
  const out: Record<string, string[]> = {};
  for (let i = 0; i < g; i++) out[groupLabel(i)] = [];
  seeded.forEach((team, i) => {
    const pass = Math.floor(i / g);
    const pos = i % g;
    out[groupLabel(pass % 2 === 0 ? pos : g - 1 - pos)].push(team);
  });
  return out;
}

export function groupStage(seeded: string[], groups: number): FixtureSpec[] {
  const split = splitIntoGroups(seeded, groups);
  const out: FixtureSpec[] = [];
  let number = 1;
  for (const [label, members] of Object.entries(split)) {
    const fixtures = roundRobin(members, 1, label, "gs", number);
    number += fixtures.length;
    out.push(...fixtures);
  }
  return out;
}

/**
 * Knockout seeding from group tables: group winners first, then runners-up,
 * both in group order (A1, B1, A2, B2). The bracket pairs seed s with seed
 * n+1-s, so A1 meets B2 and B1 meets A2: teams from the same group are kept
 * apart in the first knockout round.
 */
export function knockoutSeedsFromGroups(tables: Record<string, string[]>, advancePerGroup: number): string[] {
  const labels = Object.keys(tables).sort();
  const seeds: string[] = [];
  for (let place = 0; place < advancePerGroup; place++) {
    for (const l of labels) if (tables[l][place]) seeds.push(tables[l][place]);
  }
  return seeds;
}

export interface TableRow {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scoreFor: number;
  scoreAgainst: number;
  diff: number;
  points: number;
}

/**
 * Points table from verified results. Tie-breakers: points, score
 * difference, score for, wins, then team id (stable).
 */
export function standings(
  teams: string[],
  results: { teamA: string; teamB: string; scoreA: number; scoreB: number; winner: string | null; isDraw: boolean }[],
  points = { win: 3, draw: 1, loss: 0 }
): TableRow[] {
  const rows = new Map<string, TableRow>(
    teams.map((t) => [t, { team: t, played: 0, won: 0, drawn: 0, lost: 0, scoreFor: 0, scoreAgainst: 0, diff: 0, points: 0 }])
  );
  for (const m of results) {
    const a = rows.get(m.teamA);
    const b = rows.get(m.teamB);
    if (!a || !b) continue;
    a.played++;
    b.played++;
    a.scoreFor += m.scoreA;
    a.scoreAgainst += m.scoreB;
    b.scoreFor += m.scoreB;
    b.scoreAgainst += m.scoreA;
    if (m.isDraw || !m.winner) {
      a.drawn++;
      b.drawn++;
      a.points += points.draw;
      b.points += points.draw;
    } else {
      const [w, l] = m.winner === m.teamA ? [a, b] : [b, a];
      w.won++;
      l.lost++;
      w.points += points.win;
      l.points += points.loss;
    }
  }
  const list = [...rows.values()];
  for (const r of list) r.diff = r.scoreFor - r.scoreAgainst;
  return list.sort((x, y) => y.points - x.points || y.diff - x.diff || y.scoreFor - x.scoreFor || y.won - x.won || x.team.localeCompare(y.team));
}
