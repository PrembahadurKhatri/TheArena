
import { api, auth, futureDate, makeGround, registerUser } from "./helpers";
import { GroundBooking } from "../src/models/GroundBooking";

describe("ground booking", () => {
  it("two users can't book the same slot at the same moment (#7)", async () => {
    const ground = await makeGround();
    const date = futureDate();
    const users = await Promise.all(Array.from({ length: 6 }, () => registerUser()));

    const results = await Promise.all(
      users.map((u) =>
        api()
          .post("/api/ground-bookings")
          .set(auth(u.token))
          .send({ groundId: ground._id.toString(), date, startTime: "18:00", endTime: "19:00" })
      )
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(5);
    expect(await GroundBooking.countDocuments({ ground: ground._id, date })).toBe(1);
  });

  it("overlapping (not identical) requests also can't both win", async () => {
    const ground = await makeGround();
    const date = futureDate();
    const [a, b] = await Promise.all([registerUser(), registerUser()]);
    const [r1, r2] = await Promise.all([
      api().post("/api/ground-bookings").set(auth(a.token)).send({ groundId: ground._id.toString(), date, startTime: "10:00", endTime: "12:00" }),
      api().post("/api/ground-bookings").set(auth(b.token)).send({ groundId: ground._id.toString(), date, startTime: "11:00", endTime: "13:00" }),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([201, 409]);
  });

  it("adjacent slots are both allowed", async () => {
    const ground = await makeGround();
    const date = futureDate();
    const [a, b] = await Promise.all([registerUser(), registerUser()]);
    const [r1, r2] = await Promise.all([
      api().post("/api/ground-bookings").set(auth(a.token)).send({ groundId: ground._id.toString(), date, startTime: "10:00", endTime: "11:00" }),
      api().post("/api/ground-bookings").set(auth(b.token)).send({ groundId: ground._id.toString(), date, startTime: "11:00", endTime: "12:00" }),
    ]);
    expect([r1.status, r2.status]).toEqual([201, 201]);
  });

  it("the price comes from the server, not the request (#5)", async () => {
    const ground = await makeGround(1200);
    const u = await registerUser();
    const res = await api()
      .post("/api/ground-bookings")
      .set(auth(u.token))
      .send({ groundId: ground._id.toString(), date: futureDate(), startTime: "06:00", endTime: "08:00", totalAmount: 1, pricePerHour: 1 });
    expect(res.status).toBe(201);
    expect(res.body.booking.totalAmount).toBe(2400);
  });
});
