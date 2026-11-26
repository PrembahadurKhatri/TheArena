import { api, auth, futureDate, makeGround, registerStaff, registerUser } from "./helpers";
import { Ground } from "../src/models/Ground";
import { GroundBooking } from "../src/models/GroundBooking";
import { Notification } from "../src/models/Notification";
import { User } from "../src/models/User";

const listing = {
  name: "Lakeside Futsal Arena",
  sports: ["futsal", "football"],
  location: "Lakeside, Pokhara",
  district: "Kaski",
  pricePerHour: 1500,
  amenities: ["Floodlights", "Parking"],
  lat: 28.2096,
  lng: 83.9856,
};

async function ownerWithApprovedGround(extra: Record<string, unknown> = {}) {
  const owner = await registerUser();
  const res = await api().post("/api/owner/grounds").set(auth(owner.token)).send({ ...listing, name: `${listing.name} ${Math.random()}`, ...extra });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const reviewer = await registerStaff(["grounds.review"]);
  await api().post(`/api/admin/grounds/${res.body.ground.id}/review`).set(auth(reviewer.token)).send({ decision: "approve" });
  return { owner, groundId: res.body.ground.id as string };
}

describe("listing a ground", () => {
  it("any player can list one; it stays hidden until staff approve it", async () => {
    const owner = await registerUser();
    const res = await api().post("/api/owner/grounds").set(auth(owner.token)).send(listing);
    expect(res.status).toBe(201);
    expect(res.body.ground).toMatchObject({ status: "pending", sports: ["futsal", "football"], province: "Gandaki Province", slug: "lakeside-futsal-arena" });
    const id = res.body.ground.id;

    expect((await api().get("/api/grounds")).body.grounds.map((g: any) => g.id)).not.toContain(id);
    expect((await api().get(`/api/grounds/${id}`)).status).toBe(404);
    expect((await api().get(`/api/grounds/${id}`).set(auth(owner.token))).status).toBe(200);

    const player = await registerUser();
    expect((await api().post(`/api/admin/grounds/${id}/review`).set(auth(player.token)).send({ decision: "approve" })).status).toBe(403);
    const reviewer = await registerStaff(["grounds.review"]);
    expect((await api().post(`/api/admin/grounds/${id}/review`).set(auth(reviewer.token)).send({ decision: "reject" })).status).toBe(400);
    expect((await api().post(`/api/admin/grounds/${id}/review`).set(auth(reviewer.token)).send({ decision: "approve" })).status).toBe(200);
    expect(await Notification.countDocuments({ recipient: owner.id, type: "ground.review" })).toBe(1);

    expect((await api().get("/api/grounds?sport=football")).body.grounds.map((g: any) => g.id)).toContain(id);
    expect((await api().get("/api/grounds/lakeside-futsal-arena")).body.ground.id).toBe(id);
  });

  it("only the owner can edit; a rejected listing goes back to review once edited", async () => {
    const owner = await registerUser();
    const id = (await api().post("/api/owner/grounds").set(auth(owner.token)).send(listing)).body.ground.id;
    const other = await registerUser();
    expect((await api().patch(`/api/owner/grounds/${id}`).set(auth(other.token)).send({ pricePerHour: 1 })).status).toBe(404);
    const reviewer = await registerStaff(["grounds.review"]);
    await api().post(`/api/admin/grounds/${id}/review`).set(auth(reviewer.token)).send({ decision: "reject", note: "Add photos" });
    const edited = await api().patch(`/api/owner/grounds/${id}`).set(auth(owner.token)).send({ description: "Now with photos" });
    expect(edited.body.ground.status).toBe("pending");
  });

  it("validates sports, price and opening hours", async () => {
    const owner = await registerUser();
    expect((await api().post("/api/owner/grounds").set(auth(owner.token)).send({ ...listing, sports: ["chess"] })).status).toBe(400);
    expect((await api().post("/api/owner/grounds").set(auth(owner.token)).send({ ...listing, pricePerHour: -5 })).status).toBe(400);
    const badHours = Array.from({ length: 7 }, () => ({ open: "20:00", close: "08:00" }));
    expect((await api().post("/api/owner/grounds").set(auth(owner.token)).send({ ...listing, openingHours: badHours })).status).toBe(400);
  });
});

describe("search and slots", () => {
  it("filters by price and near me", async () => {
    await ownerWithApprovedGround({ pricePerHour: 800 });
    await ownerWithApprovedGround({ pricePerHour: 3000, lat: 27.7172, lng: 85.324, district: "Kathmandu" });
    expect((await api().get("/api/grounds?maxPrice=1000")).body.grounds).toHaveLength(1);
    expect((await api().get("/api/grounds?lat=27.70&lng=85.31&radiusKm=10")).body.grounds.map((g: any) => g.pricePerHour)).toEqual([3000]);
  });

  it("slots follow opening hours and show what's taken", async () => {
    const hours = Array.from({ length: 7 }, () => ({ open: "08:00", close: "12:00" }));
    const { groundId } = await ownerWithApprovedGround({ openingHours: hours, slotMinutes: 60 });
    const date = futureDate(5);
    const player = await registerUser();
    await api().post("/api/ground-bookings").set(auth(player.token)).send({ groundId, date, startTime: "09:00", endTime: "10:00", paymentMethod: "pay_at_venue" });
    const res = await api().get(`/api/grounds/${groundId}/slots?date=${date}`);
    expect(res.body.slots.map((s: any) => [s.startTime, s.available])).toEqual([
      ["08:00", true],
      ["09:00", false],
      ["10:00", true],
      ["11:00", true],
    ]);
    // Outside opening hours is refused.
    expect((await api().post("/api/ground-bookings").set(auth(player.token)).send({ groundId, date, startTime: "13:00", endTime: "14:00" })).status).toBe(400);
  });

  it("a closed day has no slots and can't be booked", async () => {
    const hours = Array.from({ length: 7 }, () => ({ closed: true }));
    const { groundId } = await ownerWithApprovedGround({ openingHours: hours });
    const date = futureDate(5);
    expect((await api().get(`/api/grounds/${groundId}/slots?date=${date}`)).body.slots).toEqual([]);
    const player = await registerUser();
    expect((await api().post("/api/ground-bookings").set(auth(player.token)).send({ groundId, date, startTime: "09:00", endTime: "10:00" })).status).toBe(400);
  });
});

describe("booking, paying at the venue and cancelling", () => {
  it("pay-at-venue holds the slot at once and notifies the owner", async () => {
    const { owner, groundId } = await ownerWithApprovedGround();
    const player = await registerUser();
    const date = futureDate(4);
    const res = await api().post("/api/ground-bookings").set(auth(player.token)).send({ groundId, date, startTime: "18:00", endTime: "19:00", paymentMethod: "pay_at_venue" });
    expect(res.status).toBe(201);
    expect(res.body.booking).toMatchObject({ status: "confirmed_unpaid", paymentMethod: "pay_at_venue", totalAmount: 1500 });
    expect(await Notification.countDocuments({ recipient: owner.id, type: "booking.confirmed" })).toBe(1);
    const other = await registerUser();
    expect((await api().post("/api/ground-bookings").set(auth(other.token)).send({ groundId, date, startTime: "18:30", endTime: "19:30" })).status).toBe(409);
  });

  it("Premium members get their plan's discount", async () => {
    const { groundId } = await ownerWithApprovedGround();
    const prem = await registerUser();
    await User.updateOne({ _id: prem.id }, { $set: { isPremium: true, membershipExpiresAt: new Date(Date.now() + 86_400_000) } });
    const res = await api().post("/api/ground-bookings").set(auth(prem.token)).send({ groundId, date: futureDate(4), startTime: "18:00", endTime: "19:00", paymentMethod: "pay_at_venue" });
    expect(res.body.booking.totalAmount).toBe(1350);
  });

  it("the booker can cancel before the cutoff, which frees the slot", async () => {
    const { owner, groundId } = await ownerWithApprovedGround();
    const player = await registerUser();
    const date = futureDate(4);
    const b = (await api().post("/api/ground-bookings").set(auth(player.token)).send({ groundId, date, startTime: "07:00", endTime: "08:00", paymentMethod: "pay_at_venue" })).body.booking;
    const stranger = await registerUser();
    expect((await api().post(`/api/ground-bookings/${b.id}/cancel`).set(auth(stranger.token))).status).toBe(404);
    expect((await api().post(`/api/ground-bookings/${b.id}/cancel`).set(auth(player.token)).send({ reason: "Rain" })).body.booking.status).toBe("cancelled");
    expect(await Notification.countDocuments({ recipient: owner.id, type: "booking.cancelled" })).toBe(1);
    expect((await api().post("/api/ground-bookings").set(auth(stranger.token)).send({ groundId, date, startTime: "07:00", endTime: "08:00", paymentMethod: "pay_at_venue" })).status).toBe(201);
  });

  it("cancelling too close to the start is refused", async () => {
    const g = await makeGround();
    const player = await registerUser();
    const b = await GroundBooking.create({ ground: g._id, user: player.id, date: futureDate(0), startTime: "23:30", endTime: "23:59", totalAmount: 100, status: "confirmed_unpaid", paymentMethod: "pay_at_venue" });
    // Start the booking within the next hour (Nepal time is UTC+5:45).
    const soon = new Date(Date.now() + 30 * 60_000 + 5.75 * 3600_000);
    await GroundBooking.updateOne({ _id: b._id }, { $set: { date: soon.toISOString().slice(0, 10), startTime: soon.toISOString().slice(11, 16), endTime: "23:59" } });
    expect((await api().post(`/api/ground-bookings/${b._id}/cancel`).set(auth(player.token))).status).toBe(400);
  });
});

describe("owner dashboard", () => {
  it("lists only the owner's bookings and runs mark-paid / cancel", async () => {
    const { owner, groundId } = await ownerWithApprovedGround();
    const player = await registerUser();
    const date = futureDate(3);
    const b = (await api().post("/api/ground-bookings").set(auth(player.token)).send({ groundId, date, startTime: "10:00", endTime: "11:00", paymentMethod: "pay_at_venue" })).body.booking;

    const list = await api().get("/api/owner/bookings").set(auth(owner.token));
    expect(list.body.bookings).toHaveLength(1);
    expect(list.body.bookings[0].bookedBy.id).toBe(player.id);
    const stranger = await registerUser();
    expect((await api().get("/api/owner/bookings").set(auth(stranger.token))).body.bookings).toHaveLength(0);
    expect((await api().post(`/api/owner/bookings/${b.id}/action`).set(auth(stranger.token)).send({ action: "mark_paid" })).status).toBe(404);

    expect((await api().post(`/api/owner/bookings/${b.id}/action`).set(auth(owner.token)).send({ action: "no_show" })).status).toBe(400); // not started
    expect((await api().post(`/api/owner/bookings/${b.id}/action`).set(auth(owner.token)).send({ action: "mark_paid" })).body.booking.status).toBe("confirmed");
    expect((await api().post(`/api/owner/bookings/${b.id}/action`).set(auth(owner.token)).send({ action: "cancel" })).status).toBe(400); // reason
    expect((await api().post(`/api/owner/bookings/${b.id}/action`).set(auth(owner.token)).send({ action: "cancel", reason: "Pitch repairs" })).body.booking.status).toBe("cancelled");
    expect(await Notification.countDocuments({ recipient: player.id, type: "booking.cancelled" })).toBe(1);
  });

  it("owners block slots, and blocked slots can't be booked", async () => {
    const { owner, groundId } = await ownerWithApprovedGround();
    const date = futureDate(6);
    const block = await api().post(`/api/owner/grounds/${groundId}/blocks`).set(auth(owner.token)).send({ date, startTime: "14:00", endTime: "16:00", note: "Maintenance" });
    expect(block.status).toBe(201);
    const player = await registerUser();
    expect((await api().post("/api/ground-bookings").set(auth(player.token)).send({ groundId, date, startTime: "15:00", endTime: "16:00" })).status).toBe(409);
    const stranger = await registerUser();
    expect((await api().post(`/api/owner/grounds/${groundId}/blocks`).set(auth(stranger.token)).send({ date, startTime: "08:00", endTime: "09:00" })).status).toBe(404);
  });

  it("owners can't book their own ground as a customer", async () => {
    const { owner, groundId } = await ownerWithApprovedGround();
    expect((await api().post("/api/ground-bookings").set(auth(owner.token)).send({ groundId, date: futureDate(3), startTime: "10:00", endTime: "11:00" })).status).toBe(400);
  });

  it("suspended grounds disappear and can't be booked", async () => {
    const { groundId } = await ownerWithApprovedGround();
    const mod = await registerStaff(["grounds.review"]);
    await api().post(`/api/admin/grounds/${groundId}/review`).set(auth(mod.token)).send({ decision: "suspend", note: "Complaints" });
    expect((await Ground.findById(groundId))!.status).toBe("suspended");
    const player = await registerUser();
    expect((await api().post("/api/ground-bookings").set(auth(player.token)).send({ groundId, date: futureDate(3), startTime: "10:00", endTime: "11:00" })).status).toBe(404);
  });
});
