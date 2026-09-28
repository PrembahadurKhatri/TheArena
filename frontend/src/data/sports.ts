// Single source of truth for the 10 sports on The Arena. The backend seeds
// its `Sport` collection with these same slugs (see backend/src/seed.ts) so
// frontend cards and backend records always line up.
export interface SportDef {
  slug: string;
  name: string;
  emoji: string; // used as a fallback icon wherever there's no photo (team/player/ground placeholders, etc.)
  color: string; // brand-ish accent color for this sport's cards/badges
  image: string | null; // null = no photo yet, card falls back to icon-only treatment
  tagline: string; // short bullet-style descriptor shown on the sport card
  nickname?: string; // optional well-known nickname, used on the featured hero card
}

export const SPORTS: SportDef[] = [
  {
    slug: "cricket",
    name: "Cricket",
    emoji: "🏏",
    color: "#F59E0B",
    image: "/sports/cricket.jpg",
    tagline: "Passion • Tradition • Glory",
  },
  {
    slug: "football",
    name: "Football",
    emoji: "⚽",
    color: "#16A34A",
    image: "/sports/football.jpg",
    tagline: "Speed • Skill • Glory",
    nickname: "The Beautiful Game",
  },
  {
    slug: "tennis",
    name: "Tennis",
    emoji: "🎾",
    color: "#A3E635",
    image: "/sports/tennis.jpg",
    tagline: "Speed • Skill • Strategy",
  },
  {
    slug: "table-tennis",
    name: "Table Tennis",
    emoji: "🏓",
    color: "#EF4444",
    image: "/sports/tt.jpg",
    tagline: "Quick • Sharp • Skilled",
  },
  {
    slug: "volleyball",
    name: "Volleyball",
    emoji: "🏐",
    color: "#38BDF8",
    image: "/sports/volleyball.jpg",
    tagline: "Teamwork • Power • Victory",
  },
  {
    slug: "hockey",
    name: "Hockey",
    emoji: "🏑",
    color: "#94A3B8",
    image: "/sports/hockey.jpg",
    tagline: "Grit • Speed • Precision",
  },
  {
    slug: "badminton",
    name: "Badminton",
    emoji: "🏸",
    color: "#22D3EE",
    image: "/sports/badminton.jpg",
    tagline: "Agility • Focus • Control",
  },
  {
    slug: "basketball",
    name: "Basketball",
    emoji: "🏀",
    color: "#FB923C",
    image: "/sports/basketball.jpg",
    tagline: "Fast • Dynamic • Exciting",
  },
  {
    slug: "kabaddi",
    name: "Kabaddi",
    emoji: "🤼",
    color: "#FACC15",
    image: "/sports/kabaddi.webp",
    tagline: "Strength • Strategy • Raid",
  },
  {
    slug: "futsal",
    name: "Futsal",
    emoji: "🥅",
    color: "#34D399",
    image: "/sports/futsal.avif",
    tagline: "Fast • Fierce • Fun",
  },
];

export function getSportBySlug(slug: string) {
  return SPORTS.find((s) => s.slug === slug);
}
