
import { api, auth, registerUser } from "./helpers";
import { Team } from "../src/models/Team";

async function teamWithMember() {
  const owner = await registerUser();
  const member = await registerUser();
  const applicant = await registerUser();
  const team = await api().post("/api/teams").set(auth(owner.token)).send({ name: "Pokhara Strikers", sport: "football" });
  const teamId = team.body.team.id as string;
  await api().post(`/api/teams/${teamId}/join-requests`).set(auth(member.token));
  await api().patch(`/api/teams/${teamId}/join-requests/${member.id}`).set(auth(owner.token)).send({ action: "accept" });
  await api().post(`/api/teams/${teamId}/join-requests`).set(auth(applicant.token));
  return { owner, member, applicant, teamId };
}

describe("team permissions (#4)", () => {
  it("a member can't take over the team", async () => {
    const { member, owner, teamId } = await teamWithMember();
    const res = await api().patch(`/api/teams/${teamId}`).set(auth(member.token)).send({ owner: member.id, name: "Mine now" });
    expect(res.status).toBe(403);
    // Even the owner can't move ownership through a plain edit.
    await api().patch(`/api/teams/${teamId}`).set(auth(owner.token)).send({ owner: member.id });
    expect((await Team.findById(teamId))!.owner.toString()).toBe(owner.id);
  });

  it("a member can't accept join requests, remove members or delete the team", async () => {
    const { member, owner, applicant, teamId } = await teamWithMember();
    expect((await api().patch(`/api/teams/${teamId}/join-requests/${applicant.id}`).set(auth(member.token)).send({ action: "accept" })).status).toBe(403);
    expect((await api().delete(`/api/teams/${teamId}/members/${owner.id}`).set(auth(member.token))).status).toBe(403);
    expect((await api().delete(`/api/teams/${teamId}`).set(auth(member.token))).status).toBe(403);
    expect(await Team.exists({ _id: teamId })).toBeTruthy();
  });

  it("the free plan is limited to one team", async () => {
    const u = await registerUser();
    expect((await api().post("/api/teams").set(auth(u.token)).send({ name: "Team One", sport: "cricket" })).status).toBe(201);
    expect((await api().post("/api/teams").set(auth(u.token)).send({ name: "Team Two", sport: "cricket" })).status).toBe(403);
  });
});
