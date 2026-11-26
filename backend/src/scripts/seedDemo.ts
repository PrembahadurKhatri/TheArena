// Demo data for trying The Arena locally: fictional players, teams, a
// tournament, a ground, a shop, staff accounts and a Super Admin.
//
//   npm run seed:demo             create the demo data (once)
//   npm run seed:demo -- --remove delete everything the demo created
//
// Every demo account uses an @demo.thearena.test email, and everything else
// hangs off those accounts, so --remove can find it all. All demo accounts
// share one password (DEMO_PASSWORD, default below). Refuses to run with
// NODE_ENV=production unless ALLOW_DEMO_SEED=true. Never sends email.
import dotenv from "dotenv";
dotenv.config();
// Demo addresses don't exist: make sure nothing is emailed.
process.env.SMTP_HOST = "";

import bcrypt from "bcrypt";
import mongoose, { Types } from "mongoose";
import { connectDB } from "../config/db";
import { loadSportRegistry } from "../utils/sports";
import { loadShopCategories } from "../utils/shopCategories";
import { loadSettings } from "../services/settingsService";
import { User, IUser } from "../models/User";
import { StaffRole } from "../models/StaffRole";
import { Team } from "../models/Team";
import { Challenge } from "../models/Challenge";
import { Match } from "../models/Match";
import { MatchReport } from "../models/MatchReport";
import { Tournament } from "../models/Tournament";
import { TournamentRegistration } from "../models/TournamentRegistration";
import { Ground } from "../models/Ground";
import { GroundBooking } from "../models/GroundBooking";
import { Store } from "../models/Store";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { SellerOrder } from "../models/SellerOrder";
import { Review, WishlistItem } from "../models/Review";
import { Notification } from "../models/Notification";
import { Announcement } from "../models/Announcement";
import { Report } from "../models/Report";
import { TeamSportStats, PlayerSportStats } from "../models/SportStats";
import { Payment } from "../models/Payment";
import { Subscription } from "../models/Subscription";
import { registerUser, updateMe } from "../services/authService";
import { ensureDefaultStaffRoles, addStaff } from "../services/staffService";
import { ensureDefaultPlans } from "../services/subscriptionsService";
import * as teams from "../services/teamsService";
import * as challenges from "../services/challengesService";
import * as reports from "../services/matchReportsService";
import * as tournaments from "../services/tournamentsService";
import * as grounds from "../services/groundsService";
import { createBooking } from "../services/groundBookingsService";
import * as stores from "../services/storesService";
import * as products from "../services/productsService";
import * as orders from "../services/ordersService";
import { createReview } from "../services/reviewsService";
import { createAnnouncement } from "../services/notificationService";
import { usernameKey } from "../utils/username";

const DOMAIN = "demo.thearena.test";
const PASSWORD = process.env.DEMO_PASSWORD || "ArenaDemo#2026";
const DEMO_EMAIL = new RegExp(`@${DOMAIN.replace(/\./g, "\\.")}$`);

const day = (n: number) => new Date(Date.now() + 5.75 * 3600_000 + n * 86_400_000).toISOString().slice(0, 10);

const PLACES = {
  ktm: { district: "Kathmandu", municipality: "Kathmandu Metropolitan City", lat: 27.7172, lng: 85.324 },
  lal: { district: "Lalitpur", municipality: "Lalitpur Metropolitan City", lat: 27.6644, lng: 85.3188 },
  bkt: { district: "Bhaktapur", municipality: "Bhaktapur Municipality", lat: 27.671, lng: 85.4298 },
  pkr: { district: "Kaski", municipality: "Pokhara Metropolitan City", lat: 28.2096, lng: 83.9856 },
} as const;
type Place = keyof typeof PLACES;

// Fictional people.
const PLAYERS: { name: string; username: string; place: Place; position: string; level: "beginner" | "intermediate" | "advanced" | "professional"; bio: string }[] = [
  { name: "Aarav Shrestha", username: "aarav10", place: "ktm", position: "Pivot", level: "advanced", bio: "Futsal every weekend. Left foot only." },
  { name: "Sujan Tamang", username: "sujan_gk", place: "ktm", position: "Goalkeeper", level: "advanced", bio: "Keeper. Loud." },
  { name: "Bikash Gurung", username: "bikashg", place: "ktm", position: "Winger", level: "intermediate", bio: "" },
  { name: "Nabin Rai", username: "nabin.rai", place: "ktm", position: "Defender", level: "intermediate", bio: "" },
  { name: "Prakash Magar", username: "prakash7", place: "ktm", position: "Winger", level: "beginner", bio: "" },
  { name: "Rohan Karki", username: "rohank", place: "lal", position: "Pivot", level: "professional", bio: "Played district league." },
  { name: "Saurav Thapa", username: "saurav_t", place: "lal", position: "Goalkeeper", level: "intermediate", bio: "" },
  { name: "Kiran Bhandari", username: "kiranb", place: "lal", position: "Defender", level: "advanced", bio: "" },
  { name: "Manish Adhikari", username: "manish_a", place: "lal", position: "Winger", level: "intermediate", bio: "" },
  { name: "Dipesh Lama", username: "dipesh.l", place: "lal", position: "Defender", level: "beginner", bio: "" },
  { name: "Anish Maharjan", username: "anishm", place: "bkt", position: "Pivot", level: "advanced", bio: "Bhaktapur born and raised." },
  { name: "Suman Prajapati", username: "suman_p", place: "bkt", position: "Goalkeeper", level: "advanced", bio: "" },
  { name: "Rajan Duwal", username: "rajand", place: "bkt", position: "Winger", level: "intermediate", bio: "" },
  { name: "Ujjwal Shakya", username: "ujjwal_s", place: "bkt", position: "Defender", level: "intermediate", bio: "" },
  { name: "Sagar Basnet", username: "sagarb", place: "bkt", position: "Winger", level: "beginner", bio: "" },
  { name: "Bibek Poudel", username: "bibekp", place: "pkr", position: "Pivot", level: "advanced", bio: "Lakeside futsal regular." },
  { name: "Roshan Pun", username: "roshan_pun", place: "pkr", position: "Goalkeeper", level: "intermediate", bio: "" },
  { name: "Aakash Baral", username: "aakash.b", place: "pkr", position: "Defender", level: "advanced", bio: "" },
  { name: "Ritesh Subedi", username: "riteshs", place: "pkr", position: "Winger", level: "intermediate", bio: "" },
  { name: "Nirajan KC", username: "nirajan_kc", place: "pkr", position: "Defender", level: "beginner", bio: "" },
  // Individual players (tennis / badminton)
  { name: "Priya Sharma", username: "priya_s", place: "ktm", position: "Singles", level: "advanced", bio: "Tennis, mostly mornings." },
  { name: "Asmita Joshi", username: "asmitaj", place: "ktm", position: "Singles", level: "intermediate", bio: "Looking for weekday matches." },
];

const TEAMS = [
  { name: "Thamel Strikers", place: "ktm" as Place, from: 0, description: "Friendly but competitive futsal side from Thamel. Training Tuesdays." },
  { name: "Patan Panthers", place: "lal" as Place, from: 5, description: "Lalitpur futsal team. We play to win." },
  { name: "Bhaktapur Bulls", place: "bkt" as Place, from: 10, description: "Durbar Square's finest. Always recruiting." },
  { name: "Lakeside United", place: "pkr" as Place, from: 15, description: "Pokhara futsal crew. Matches by the lake every Friday." },
];

async function makeUser(name: string, local: string, extra: Partial<IUser> = {}) {
  const email = `${local}@${DOMAIN}`;
  // Some locals ("admin", "support") are reserved usernames: prefix those.
  let username = local.replace(/[^a-z0-9_.]/gi, "").slice(0, 20);
  if (["admin", "support", "staff", "arena"].includes(username)) username = `demo_${username}`;
  const { user } = await registerUser({ name, email, password: PASSWORD, username });
  if (Object.keys(extra).length) await User.updateOne({ _id: user._id }, { $set: extra });
  return (await User.findById(user._id))!;
}

const fresh = async (u: IUser) => (await User.findById(u._id))!;

async function removeDemo() {
  const users = await User.find({ email: DEMO_EMAIL }).select("_id");
  const ids = users.map((u) => u._id);
  if (!ids.length) {
    console.log("[seed:demo] nothing to remove");
    return;
  }
  const teamIds = (await Team.find({ owner: { $in: ids } }).select("_id")).map((t) => t._id);
  const tournamentIds = (await Tournament.find({ organizer: { $in: ids } }).select("_id")).map((t) => t._id);
  const storeIds = (await Store.find({ owner: { $in: ids } }).select("_id")).map((s) => s._id);
  const groundIds = (await Ground.find({ owner: { $in: ids } }).select("_id")).map((g) => g._id);
  const challengeIds = (await Challenge.find({ challenger: { $in: ids } }).select("_id")).map((c) => c._id);
  const matchIds = (
    await Match.find({ $or: [{ tournament: { $in: tournamentIds } }, { challenge: { $in: challengeIds } }, { teamA: { $in: teamIds } }, { userA: { $in: ids } }] }).select("_id")
  ).map((m) => m._id);
  const results = await Promise.all([
    MatchReport.deleteMany({ match: { $in: matchIds } }),
    Match.deleteMany({ _id: { $in: matchIds } }),
    Challenge.deleteMany({ _id: { $in: challengeIds } }),
    TournamentRegistration.deleteMany({ $or: [{ tournament: { $in: tournamentIds } }, { team: { $in: teamIds } }] }),
    Tournament.deleteMany({ _id: { $in: tournamentIds } }),
    TeamSportStats.deleteMany({ team: { $in: teamIds } }),
    PlayerSportStats.deleteMany({ user: { $in: ids } }),
    Team.deleteMany({ _id: { $in: teamIds } }),
    GroundBooking.deleteMany({ $or: [{ ground: { $in: groundIds } }, { user: { $in: ids } }] }),
    Ground.deleteMany({ _id: { $in: groundIds } }),
    Review.deleteMany({ $or: [{ user: { $in: ids } }, { store: { $in: storeIds } }] }),
    WishlistItem.deleteMany({ user: { $in: ids } }),
    SellerOrder.deleteMany({ $or: [{ buyer: { $in: ids } }, { store: { $in: storeIds } }] }),
    Order.deleteMany({ buyer: { $in: ids } }),
    Product.deleteMany({ store: { $in: storeIds } }),
    Store.deleteMany({ _id: { $in: storeIds } }),
    Notification.deleteMany({ recipient: { $in: ids } }),
    Announcement.deleteMany({ createdBy: { $in: ids } }),
    Report.deleteMany({ reporter: { $in: ids } }),
    Payment.deleteMany({ user: { $in: ids } }),
    Subscription.deleteMany({ owner: { $in: ids } }),
  ]);
  await User.deleteMany({ _id: { $in: ids } });
  const n = results.reduce((s, r) => s + r.deletedCount, 0);
  console.log(`[seed:demo] removed ${ids.length} demo accounts and ${n} related records (audit log entries are kept: the log is append-only)`);
}

async function createDemo() {
  if (await User.exists({ email: `admin@${DOMAIN}` })) {
    console.log("[seed:demo] demo data already exists. Run with --remove first to recreate it.");
    return;
  }
  await ensureDefaultStaffRoles();
  await ensureDefaultPlans();

  // ---------------------------------------------------------------- staff
  const admin = await makeUser("Demo Super Admin", "admin");
  await User.updateOne({ _id: admin._id }, { $set: { role: "admin", isSuperAdmin: true } });
  const superAdmin = await fresh(admin);
  const staffDefs = [
    ["Tara Manager", "tournaments", "tournament_manager"],
    ["Milan Merchant-Desk", "merchants", "merchant_manager"],
    ["Gita Grounds", "grounds", "ground_manager"],
    ["Hari Support", "support", "support_manager"],
  ] as const;
  for (const [name, local, roleKey] of staffDefs) {
    const u = await makeUser(name, local);
    const role = await StaffRole.findOne({ key: roleKey });
    await addStaff(superAdmin, { userId: u._id.toString(), staffRoleId: role?._id.toString() });
  }

  // ---------------------------------------------------------------- players
  const players: IUser[] = [];
  for (const p of PLAYERS) {
    const place = PLACES[p.place];
    const u = await makeUser(p.name, p.username);
    const sport = p.position === "Singles" ? "tennis" : "futsal";
    await updateMe(u, {
      district: place.district,
      municipality: place.municipality,
      lat: place.lat + (Math.random() - 0.5) * 0.02,
      lng: place.lng + (Math.random() - 0.5) * 0.02,
      bio: p.bio || undefined,
      sportProfiles: [{ sport, position: p.position, experienceLevel: p.level }, ...(sport === "futsal" ? [{ sport: "football", position: "Midfielder", experienceLevel: "intermediate" }] : [])],
      privacy: { showPhone: false, showAge: false },
      dateOfBirth: `${1995 + Math.floor(Math.random() * 10)}-0${1 + Math.floor(Math.random() * 8)}-1${Math.floor(Math.random() * 9)}`,
    });
    players.push(await fresh(u));
  }

  // Premium organizer (Premium is needed to host tournaments).
  const organizer = await makeUser("Kabir Organiser", "organiser");
  await User.updateOne(
    { _id: organizer._id },
    { $set: { isPremium: true, membershipExpiresAt: new Date(Date.now() + 365 * 86_400_000), district: "Kathmandu", province: "Bagmati Province" } }
  );

  // ---------------------------------------------------------------- teams
  const teamDocs = [];
  for (const t of TEAMS) {
    const owner = players[t.from];
    const team = await teams.createTeam(owner, { name: t.name, sport: "futsal", description: t.description, district: PLACES[t.place].district, lat: PLACES[t.place].lat, lng: PLACES[t.place].lng });
    for (let i = 1; i < 5; i++) {
      const member = players[t.from + i];
      await teams.invitePlayer(team!._id.toString(), owner, { userId: member._id.toString() });
      await teams.respondToInvitation(team!._id.toString(), member, "accept");
    }
    await teams.setMemberRole(team!._id.toString(), players[t.from + 1]._id.toString(), owner, "captain");
    await teams.setMemberRole(team!._id.toString(), players[t.from + 2]._id.toString(), owner, "vice_captain");
    teamDocs.push((await Team.findById(team!._id))!);
  }
  // A pending join request, so the team dashboard has something to show.
  await teams.requestToJoin(teamDocs[0]._id.toString(), players[20]);

  // ---------------------------------------------------------------- challenges and a played match
  const [strikers, panthers, bulls, lakeside] = teamDocs;
  const played = await challenges.createChallenge(players[0], {
    sport: "futsal",
    mode: "team",
    teamId: strikers._id.toString(),
    opponentTeamId: panthers._id.toString(),
    date: day(2),
    startTime: "18:00",
    endTime: "19:00",
    venueNote: "Dhuku Futsal, Kathmandu",
    message: "Friendly before the cup?",
  });
  await challenges.acceptChallenge(players[6], played._id.toString(), {}); // Patan's captain
  const playedMatch = await Match.findOne({ challenge: played._id });
  // Pretend it was played yesterday, then report and confirm the result.
  await Match.updateOne({ _id: playedMatch!._id }, { $set: { date: day(-1) } });
  const rep = await reports.submitReport(players[0], playedMatch!._id.toString(), {
    scoreA: 5,
    scoreB: 3,
    detail: "Close first half, Strikers pulled away late",
    players: [
      { user: players[0]._id.toString(), side: "A", stats: { goals: 3, assists: 1 } },
      { user: players[2]._id.toString(), side: "A", stats: { goals: 2 } },
      { user: players[5]._id.toString(), side: "B", stats: { goals: 2, yellow_cards: 1 } },
      { user: players[7]._id.toString(), side: "B", stats: { goals: 1 } },
    ],
  });
  await reports.confirmReport(players[5], rep._id.toString());

  // An open challenge and one waiting for an answer (with a counter-proposal).
  await challenges.createChallenge(players[10], { sport: "futsal", mode: "team", teamId: bulls._id.toString(), date: day(5), startTime: "17:00", endTime: "18:00", province: "Bagmati Province", venueNote: "Bhaktapur Futsal Hub", message: "Anyone up for a match?" });
  const pending = await challenges.createChallenge(players[15], { sport: "futsal", mode: "team", teamId: lakeside._id.toString(), opponentTeamId: strikers._id.toString(), date: day(9), startTime: "16:00", endTime: "17:00", message: "Come to Pokhara!" });
  await challenges.counterChallenge(players[0], pending._id.toString(), { date: day(10), startTime: "15:00", endTime: "16:00", message: "Saturday works better for us" });
  // One-on-one tennis challenge.
  await challenges.createChallenge(players[20], { sport: "tennis", mode: "player", opponentUserId: players[21]._id.toString(), date: day(3), startTime: "07:00", endTime: "08:30", venueNote: "Satdobato Tennis Court", message: "Morning hit?" });

  // ---------------------------------------------------------------- tournament (knockout, in progress)
  const cup = await tournaments.createTournament(await fresh(organizer), {
    name: "Valley Futsal Cup",
    sport: "futsal",
    format: "knockout",
    maxTeams: 8,
    minTeams: 4,
    startDate: day(14),
    registrationClosesAt: day(12),
    province: "Bagmati Province",
    district: "Kathmandu",
    location: "Dhuku Futsal, Kathmandu",
    entryFee: 3000,
    prizes: "Rs 30,000 for the winners, Rs 10,000 runners-up",
    rules: "5-a-side, 2 x 20 minutes. Penalties if level in knockout games.",
    description: "Eight-team knockout for clubs from across the valley and beyond.",
  });
  for (const [i, team] of teamDocs.entries()) {
    const owner = players[TEAMS[i].from];
    const reg = await tournaments.requestRegistration(cup!._id.toString(), owner, team._id.toString());
    await tournaments.respondToRegistration(cup!._id.toString(), reg._id.toString(), await fresh(organizer), { action: "approve" });
  }
  await tournaments.submitForReview(cup!._id.toString(), await fresh(organizer));
  await tournaments.adminReview(superAdmin, cup!._id.toString(), { decision: "approve", note: "Looks good." });
  await tournaments.startTournament(cup!._id.toString(), await fresh(organizer));
  const semis = await Match.find({ tournament: cup!._id, round: 1 }).sort({ matchNumber: 1 });
  // Semi 1 verified (bracket moves on); semi 2 reported, waiting for confirmation.
  const owners = new Map(teamDocs.map((t, i) => [t._id.toString(), players[TEAMS[i].from]]));
  const r1 = await reports.submitReport(await fresh(organizer), semis[0]._id.toString(), { scoreA: 4, scoreB: 2 });
  await reports.confirmReport(owners.get(semis[0].teamA!.toString())!, r1._id.toString());
  await reports.submitReport(await fresh(organizer), semis[1]._id.toString(), { scoreA: 2, scoreB: 2, outcome: "B", detail: "B won 4-3 on penalties" });

  // A second tournament still taking teams.
  await tournaments.createTournament(await fresh(organizer), {
    name: "Pokhara Lakeside League",
    sport: "futsal",
    format: "round_robin",
    maxTeams: 6,
    startDate: day(30),
    province: "Gandaki Province",
    district: "Kaski",
    location: "Lakeside, Pokhara",
    prizes: "Trophy and medals",
    description: "Everyone plays everyone. Best record wins.",
  });

  // ---------------------------------------------------------------- ground owner
  const gOwner = await makeUser("Ramesh Ground-Owner", "groundowner");
  const ground = await grounds.createOwnedGround(gOwner, {
    name: "Dhuku Futsal Arena",
    sports: ["futsal", "football"],
    location: "Baluwatar, Kathmandu",
    address: "Baluwatar Road",
    district: "Kathmandu",
    municipality: "Kathmandu Metropolitan City",
    lat: 27.7266,
    lng: 85.3305,
    pricePerHour: 1800,
    amenities: ["Floodlights", "Changing rooms", "Parking", "Drinking water"],
    description: "Two artificial-turf futsal courts with floodlights.",
    contactPhone: "9800000000",
  }, []);
  await grounds.adminReviewGround(superAdmin, ground._id.toString(), { decision: "approve" });
  await grounds.createOwnedGround(gOwner, { name: "Baluwatar Indoor Court", sports: ["badminton", "basketball"], location: "Baluwatar, Kathmandu", district: "Kathmandu", pricePerHour: 900 }, []);
  await createBooking(players[3], { groundId: ground._id.toString(), date: day(4), startTime: "19:00", endTime: "20:00", paymentMethod: "pay_at_venue" });
  await createBooking(players[8], { groundId: ground._id.toString(), date: day(6), startTime: "07:00", endTime: "09:00", paymentMethod: "pay_at_venue" });

  // ---------------------------------------------------------------- shop
  const merchant = await makeUser("Sita Sports-Shop", "merchant");
  const store = await stores.createStore(merchant, {
    name: "Himal Sports Gear",
    description: "Football, futsal and cricket gear. Delivery inside the valley.",
    phone: "9811111111",
    address: "New Road, Kathmandu",
    district: "Kathmandu",
  });
  await stores.adminReviewStore(superAdmin, store._id.toString(), { decision: "approve" });
  const catalogue = [
    { name: "Pro Futsal Ball (Size 4)", category: "Balls", sport: "futsal", brand: "Arena Pro", price: 2200, discountPrice: 1850, stock: 25, description: "Low-bounce futsal ball, hand-stitched." },
    { name: "Club Jersey", category: "Jerseys", sport: "futsal", brand: "Arena Kit", price: 1500, variants: [{ size: "S", stock: 5 }, { size: "M", stock: 10 }, { size: "L", stock: 8 }, { size: "XL", stock: 0 }], description: "Breathable match jersey." },
    { name: "Indoor Court Shoes", category: "Footwear", sport: "futsal", brand: "Kathmandu Kicks", price: 4800, variants: [{ size: "40", stock: 3 }, { size: "41", stock: 4 }, { size: "42", stock: 2 }], description: "Gum sole for indoor courts." },
    { name: "English Willow Bat", category: "Bats", sport: "cricket", brand: "Himal Willow", price: 12500, stock: 4, description: "Grade 2 English willow, short handle." },
    { name: "Goalkeeper Gloves", category: "Protective Gear", sport: "football", brand: "Arena Pro", price: 1900, stock: 12 },
    { name: "Resistance Band Set", category: "Fitness Equipment", price: 1200, stock: 20, description: "Five bands, light to extra heavy." },
  ];
  const productIds: string[] = [];
  for (const c of catalogue) {
    const p = await products.createProduct(merchant, c);
    await products.adminReviewProduct(superAdmin, p!._id.toString(), { decision: "approve" });
    productIds.push(p!._id.toString());
  }
  // One more waiting for review (shows up in the admin queue).
  await products.createProduct(merchant, { name: "Shin Guards", category: "Protective Gear", sport: "football", price: 900, stock: 30 });
  await products.adminReviewProduct(superAdmin, productIds[0], { featured: true });

  // A delivered cash-on-delivery order with a review, and one still open.
  const jersey = await Product.findById(productIds[1]);
  const delivered = await orders.createOrder(players[0], {
    items: [
      { productId: productIds[0], quantity: 2 },
      { productId: productIds[1], variantId: jersey!.variants.find((v) => v.size === "M")!._id.toString(), quantity: 1 },
    ],
    paymentMethod: "cod",
    shippingAddress: "Thamel, Kathmandu",
    shippingProvince: "Bagmati Province",
    contactName: players[0].name,
    contactPhone: "9822222222",
  });
  const so = await SellerOrder.findOne({ order: delivered!._id });
  for (const status of ["confirmed", "shipped", "delivered"]) {
    await orders.updateSellerOrderStatus(merchant, so!._id.toString(), { status, carrier: "Pathao", trackingCode: "PTH-1001" });
  }
  await createReview(players[0], productIds[0], { rating: 5, text: "Great grip on the court, holds its shape." });
  await orders.createOrder(players[11], {
    items: [{ productId: productIds[3], quantity: 1 }],
    paymentMethod: "cod",
    shippingAddress: "Suryabinayak, Bhaktapur",
    shippingProvince: "Bagmati Province",
    contactPhone: "9833333333",
  });

  // ---------------------------------------------------------------- a report and an announcement
  await Report.create({ reporter: players[4]._id, targetType: "team", targetId: lakeside._id, reason: "fake", details: "Demo report: claims to be the official Pokhara club." });
  await createAnnouncement(superAdmin, { title: "Welcome to The Arena (demo)", body: "This is demo data. Explore teams, the Valley Futsal Cup, Dhuku Futsal Arena and Himal Sports Gear." });

  console.log(`
[seed:demo] done. Every demo account uses the password: ${PASSWORD}

  Super Admin      admin@${DOMAIN}
  Staff            tournaments@, merchants@, grounds@, support@${DOMAIN}
  Tournament host  organiser@${DOMAIN}   (Premium)
  Ground owner     groundowner@${DOMAIN}
  Merchant         merchant@${DOMAIN}
  Team owners      aarav10@, rohank@, anishm@, bibekp@${DOMAIN}
  Other players    e.g. sujan_gk@, priya_s@, asmitaj@${DOMAIN}

Remove everything with: npm run seed:demo -- --remove
`);
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Refusing to create demo data with NODE_ENV=production (set ALLOW_DEMO_SEED=true to override)");
  }
  await connectDB();
  await loadSportRegistry();
  await loadShopCategories();
  await loadSettings();
  if (process.argv.includes("--remove")) await removeDemo();
  else await createDemo();
}

void usernameKey;
void Types;
void bcrypt;

main()
  .catch((err) => {
    console.error("[seed:demo] failed:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
