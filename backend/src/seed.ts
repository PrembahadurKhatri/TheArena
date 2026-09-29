import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { connectDB } from "./config/db";
import { Sport } from "./models/Sport";
import { Ground } from "./models/Ground";
import { User } from "./models/User";
import { Store } from "./models/Store";
import { Product } from "./models/Product";

const SPORTS: { slug: string; name: string; order: number }[] = [
  { slug: "cricket", name: "Cricket", order: 1 },
  { slug: "football", name: "Football", order: 2 },
  { slug: "tennis", name: "Tennis", order: 3 },
  { slug: "table-tennis", name: "Table Tennis", order: 4 },
  { slug: "volleyball", name: "Volleyball", order: 5 },
  { slug: "hockey", name: "Hockey", order: 6 },
  { slug: "badminton", name: "Badminton", order: 7 },
  { slug: "basketball", name: "Basketball", order: 8 },
  { slug: "kabaddi", name: "Kabaddi", order: 9 },
  { slug: "futsal", name: "Futsal", order: 10 },
];

const GROUNDS: {
  sport: string;
  name: string;
  location: string;
  pricePerHour: number;
  amenities: string[];
}[] = [
  // cricket
  { sport: "cricket", name: "Kirtipur Cricket Ground", location: "Kirtipur, Kathmandu", pricePerHour: 2000, amenities: ["Floodlights", "Nets", "Parking"] },
  { sport: "cricket", name: "TU Cricket Ground", location: "Kirtipur, Kathmandu", pricePerHour: 1800, amenities: ["Pavilion", "Parking"] },
  { sport: "cricket", name: "Pokhara Cricket Ground", location: "Pokhara", pricePerHour: 1500, amenities: ["Nets", "Scoreboard"] },

  // football
  { sport: "football", name: "Dasharath Stadium Turf", location: "Tripureshwor, Kathmandu", pricePerHour: 2500, amenities: ["Floodlights", "Changing Room"] },
  { sport: "football", name: "ANFA Complex", location: "Satdobato, Lalitpur", pricePerHour: 2200, amenities: ["Artificial Turf", "Parking"] },
  { sport: "football", name: "Green Turf Futsal & Football", location: "Baneshwor, Kathmandu", pricePerHour: 1800, amenities: ["Floodlights"] },

  // tennis
  { sport: "tennis", name: "Satdobato Tennis Court", location: "Satdobato, Lalitpur", pricePerHour: 1000, amenities: ["Hard Court", "Coaching"] },
  { sport: "tennis", name: "Army Club Tennis Court", location: "Bhadrakali, Kathmandu", pricePerHour: 1200, amenities: ["Clay Court", "Floodlights"] },

  // table-tennis
  { sport: "table-tennis", name: "TT Zone Baneshwor", location: "Baneshwor, Kathmandu", pricePerHour: 800, amenities: ["AC Hall", "Equipment Rental"] },
  { sport: "table-tennis", name: "Pulchowk TT Club", location: "Pulchowk, Lalitpur", pricePerHour: 850, amenities: ["Equipment Rental"] },

  // volleyball
  { sport: "volleyball", name: "Nepal Volleyball Court", location: "Tundikhel, Kathmandu", pricePerHour: 1000, amenities: ["Open Court", "Floodlights"] },
  { sport: "volleyball", name: "Lalitpur Volleyball Arena", location: "Jawalakhel, Lalitpur", pricePerHour: 950, amenities: ["Indoor Court"] },

  // hockey
  { sport: "hockey", name: "National Hockey Ground", location: "Tripureshwor, Kathmandu", pricePerHour: 1800, amenities: ["Astroturf", "Floodlights"] },
  { sport: "hockey", name: "Bhrikutimandap Hockey Field", location: "Bhrikutimandap, Kathmandu", pricePerHour: 1600, amenities: ["Parking"] },

  // badminton
  { sport: "badminton", name: "Shuttle Point Kathmandu", location: "New Baneshwor, Kathmandu", pricePerHour: 900, amenities: ["Wooden Court", "AC Hall"] },
  { sport: "badminton", name: "Smash Arena Lalitpur", location: "Kupondole, Lalitpur", pricePerHour: 950, amenities: ["Equipment Rental", "Parking"] },
  { sport: "badminton", name: "Pokhara Badminton Hall", location: "Pokhara", pricePerHour: 800, amenities: ["Indoor Court"] },

  // basketball
  { sport: "basketball", name: "Tripureshwor Basketball Court", location: "Tripureshwor, Kathmandu", pricePerHour: 1200, amenities: ["Outdoor Court", "Floodlights"] },
  { sport: "basketball", name: "Chyasal Basketball Arena", location: "Chyasal, Lalitpur", pricePerHour: 1100, amenities: ["Indoor Court"] },

  // kabaddi
  { sport: "kabaddi", name: "Tundikhel Kabaddi Ground", location: "Tundikhel, Kathmandu", pricePerHour: 900, amenities: ["Open Ground"] },
  { sport: "kabaddi", name: "Birgunj Kabaddi Arena", location: "Birgunj", pricePerHour: 850, amenities: ["Open Ground", "Seating"] },

  // futsal
  { sport: "futsal", name: "Kickoff Futsal Baneshwor", location: "Baneshwor, Kathmandu", pricePerHour: 1500, amenities: ["Artificial Turf", "Floodlights"] },
  { sport: "futsal", name: "Soccer World Futsal", location: "Kalanki, Kathmandu", pricePerHour: 1400, amenities: ["Indoor Turf", "Changing Room"] },
  { sport: "futsal", name: "Lalitpur Futsal Arena", location: "Pulchowk, Lalitpur", pricePerHour: 1600, amenities: ["Artificial Turf", "Parking"] },
];

const SEED_STORE_PASSWORD = "SeedStore123!";

const STORE_SEEDS: {
  ownerEmail: string;
  ownerName: string;
  storeName: string;
  description: string;
  province: string;
  products: {
    name: string;
    description: string;
    category: string;
    sport: string | null;
    price: number;
    stock: number;
  }[];
}[] = [
  {
    ownerEmail: "store1@thearena.local",
    ownerName: "Kathmandu Sports Hub Owner",
    storeName: "Kathmandu Sports Hub",
    description: "Your one-stop shop for cricket and football gear in the valley.",
    province: "Bagmati Province",
    products: [
      { name: "SG Elite English Willow Cricket Bat", description: "Grade 1 English willow, full-size, pre-knocked.", category: "Bats", sport: "cricket", price: 12500, stock: 15 },
      { name: "Kookaburra Turf Cricket Ball (Red)", description: "Match-quality leather cricket ball, 156g.", category: "Balls", sport: "cricket", price: 1800, stock: 60 },
      { name: "Nivia Storm FIFA Football (Size 5)", description: "Thermally bonded match football.", category: "Balls", sport: "football", price: 3200, stock: 40 },
      { name: "The Arena FC Home Jersey", description: "Breathable polyester jersey, club colours.", category: "Jerseys", sport: "football", price: 2200, stock: 50 },
      { name: "Cricket Batting Pads (Youth)", description: "Lightweight protective leg guards for junior batters.", category: "Protective Gear", sport: "cricket", price: 3500, stock: 20 },
      { name: "Arena Sports Water Bottle 1L", description: "BPA-free insulated sports bottle, fits any kit bag.", category: "Accessories", sport: null, price: 650, stock: 100 },
    ],
  },
  {
    ownerEmail: "store2@thearena.local",
    ownerName: "Pokhara Gear Co. Owner",
    storeName: "Pokhara Gear Co.",
    description: "Footwear, rackets and everyday sports essentials from Pokhara.",
    province: "Gandaki Province",
    products: [
      { name: "Yonex Voltric Badminton Racket", description: "Head-heavy racket for powerful smashes.", category: "Rackets", sport: "badminton", price: 8500, stock: 25 },
      { name: "Nike Mercurial Football Boots", description: "Firm-ground boots with a lightweight synthetic upper.", category: "Footwear", sport: "football", price: 9800, stock: 18 },
      { name: "Li-Ning Table Tennis Paddle Set", description: "Two paddles + 3 balls, tournament-grade rubber.", category: "Rackets", sport: "table-tennis", price: 2800, stock: 30 },
      { name: "Volleyball Knee Pads", description: "Shock-absorbing foam pads for diving digs.", category: "Protective Gear", sport: "volleyball", price: 1200, stock: 45 },
      { name: "Molten Basketball (Size 7)", description: "Composite leather indoor/outdoor basketball.", category: "Balls", sport: "basketball", price: 4200, stock: 22 },
    ],
  },
];

async function seedShop() {
  console.log("[seed] upserting shop stores + products...");
  for (const s of STORE_SEEDS) {
    const passwordHash = await bcrypt.hash(SEED_STORE_PASSWORD, 10);
    const owner = await User.findOneAndUpdate(
      { email: s.ownerEmail },
      {
        $setOnInsert: { passwordHash },
        $set: { name: s.ownerName, province: s.province },
      },
      { upsert: true, new: true }
    );

    const store = await Store.findOneAndUpdate(
      { owner: owner._id },
      { $set: { name: s.storeName, description: s.description } },
      { upsert: true, new: true }
    );

    for (const p of s.products) {
      await Product.findOneAndUpdate(
        { store: store._id, name: p.name },
        {
          $set: {
            description: p.description,
            category: p.category,
            sport: p.sport,
            price: p.price,
            stock: p.stock,
          },
        },
        { upsert: true, new: true }
      );
    }
  }
  console.log(`[seed] ${STORE_SEEDS.length} stores upserted (test password: "${SEED_STORE_PASSWORD}")`);
}

async function seed() {
  await connectDB();

  console.log("[seed] upserting sports...");
  for (const s of SPORTS) {
    await Sport.findOneAndUpdate(
      { slug: s.slug },
      { $set: { name: s.name, order: s.order } },
      { upsert: true, new: true }
    );
  }
  console.log(`[seed] ${SPORTS.length} sports upserted`);

  console.log("[seed] upserting grounds...");
  for (const g of GROUNDS) {
    await Ground.findOneAndUpdate(
      { name: g.name, location: g.location },
      {
        $set: {
          sport: g.sport,
          pricePerHour: g.pricePerHour,
          amenities: g.amenities,
          image: null,
        },
      },
      { upsert: true, new: true }
    );
  }
  console.log(`[seed] ${GROUNDS.length} grounds upserted`);

  await seedShop();

  console.log("[seed] done.");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
