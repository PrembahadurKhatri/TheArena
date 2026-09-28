import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "./config/db";
import { Sport } from "./models/Sport";
import { Ground } from "./models/Ground";

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

  console.log("[seed] done.");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
