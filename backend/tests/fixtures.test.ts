import * as fx from "../src/services/fixtures";

const teams = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`);

describe("knockout brackets", () => {
  it("seeds so the top two can only meet in the final", () => {
    expect(fx.seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(fx.seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("pads to a power of two with byes only in round 1, going to top seeds", () => {
    const specs = fx.knockout(teams(6));
    expect(specs).toHaveLength(7); // 4 + 2 + 1
    const r1 = specs.filter((s) => s.round === 1);
    const byes = r1.filter((s) => !s.teamA || !s.teamB);
    expect(byes).toHaveLength(2);
    expect(byes.map((s) => s.teamA ?? s.teamB).sort()).toEqual(["t1", "t2"]);
    expect(specs.filter((s) => s.round > 1).every((s) => !s.teamA && !s.teamB)).toBe(true);
  });

  it("links every match to the next round; the final links nowhere", () => {
    const specs = fx.knockout(teams(8));
    const keys = new Set(specs.map((s) => s.key));
    const final = specs.filter((s) => !s.nextKey);
    expect(final).toHaveLength(1);
    expect(final[0].round).toBe(3);
    for (const s of specs) if (s.nextKey) expect(keys.has(s.nextKey)).toBe(true);
    // Each next match receives exactly one A and one B feeder.
    const feeders = new Map<string, string[]>();
    for (const s of specs) if (s.nextKey) feeders.set(s.nextKey, [...(feeders.get(s.nextKey) ?? []), s.nextSlot!]);
    for (const slots of feeders.values()) expect(slots.sort()).toEqual(["A", "B"]);
  });
});

describe("round robin and league", () => {
  it("every pair meets exactly once per leg", () => {
    for (const n of [4, 5, 6, 7]) {
      const specs = fx.roundRobin(teams(n), 1);
      expect(specs).toHaveLength((n * (n - 1)) / 2);
      const pairs = new Set(specs.map((s) => [s.teamA, s.teamB].sort().join("-")));
      expect(pairs.size).toBe(specs.length);
    }
  });

  it("a home-and-away league plays each pair twice, once each way", () => {
    const specs = fx.roundRobin(teams(4), 2);
    expect(specs).toHaveLength(12);
    const directed = new Set(specs.map((s) => `${s.teamA}>${s.teamB}`));
    expect(directed.size).toBe(12);
  });

  it("nobody plays twice in the same round", () => {
    const specs = fx.roundRobin(teams(6), 1);
    const byRound = new Map<number, string[]>();
    for (const s of specs) byRound.set(s.round, [...(byRound.get(s.round) ?? []), s.teamA!, s.teamB!]);
    for (const list of byRound.values()) expect(new Set(list).size).toBe(list.length);
  });
});

describe("groups", () => {
  it("snake seeding keeps groups balanced", () => {
    const g = fx.splitIntoGroups(teams(8), 2);
    expect(g).toEqual({ A: ["t1", "t4", "t5", "t8"], B: ["t2", "t3", "t6", "t7"] });
  });

  it("group stage is a round robin inside each group", () => {
    const specs = fx.groupStage(teams(8), 2);
    expect(specs).toHaveLength(12); // 6 per group of 4
    expect(new Set(specs.map((s) => s.group))).toEqual(new Set(["A", "B"]));
    expect(specs.every((s) => s.stage === "group")).toBe(true);
  });

  it("knockout seeds keep group-mates apart in the first round", () => {
    const seeds = fx.knockoutSeedsFromGroups({ A: ["a1", "a2", "a3"], B: ["b1", "b2", "b3"] }, 2);
    expect(seeds).toEqual(["a1", "b1", "a2", "b2"]);
    const r1 = fx.knockout(seeds).filter((s) => s.round === 1);
    for (const m of r1) expect(m.teamA![0]).not.toBe(m.teamB![0]);
  });
});

describe("standings", () => {
  it("ranks by points, then score difference, then score for", () => {
    const rows = fx.standings(
      ["a", "b", "c"],
      [
        { teamA: "a", teamB: "b", scoreA: 2, scoreB: 0, winner: "a", isDraw: false },
        { teamA: "b", teamB: "c", scoreA: 1, scoreB: 1, winner: null, isDraw: true },
        { teamA: "c", teamB: "a", scoreA: 3, scoreB: 0, winner: "c", isDraw: false },
      ]
    );
    expect(rows.map((r) => [r.team, r.points])).toEqual([
      ["c", 4],
      ["a", 3],
      ["b", 1],
    ]);
    expect(rows[0]).toMatchObject({ played: 2, won: 1, drawn: 1, scoreFor: 4, scoreAgainst: 1, diff: 3 });
  });
});
