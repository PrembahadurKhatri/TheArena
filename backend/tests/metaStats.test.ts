import { api } from "./helpers";
import { Ground } from "../src/models/Ground";
import { Tournament } from "../src/models/Tournament";

describe("GET /api/meta/stats", () => {
  it("is public and counts only live, visible records", async () => {
    const res = await api().get("/api/meta/stats");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sports: expect.any(Number),
      teams: expect.any(Number),
      grounds: expect.any(Number),
      tournaments: expect.any(Number),
    });
    const visibleGrounds = await Ground.countDocuments({ status: { $in: ["approved", null] } });
    const liveTournaments = await Tournament.countDocuments({ status: { $nin: ["cancelled", "rejected"] } });
    expect(res.body.grounds).toBe(visibleGrounds);
    expect(res.body.tournaments).toBe(liveTournaments);
  });
});
