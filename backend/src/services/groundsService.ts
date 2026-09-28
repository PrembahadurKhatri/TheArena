import { Ground } from "../models/Ground";
import { AppError } from "../utils/AppError";

export async function listGrounds(filters: { sport?: string; search?: string }) {
  const query: any = {};
  if (filters.sport) query.sport = filters.sport;
  if (filters.search) query.name = { $regex: filters.search, $options: "i" };
  return Ground.find(query).sort({ createdAt: -1 });
}

export async function getGroundById(id: string) {
  const ground = await Ground.findById(id);
  if (!ground) throw new AppError(404, "Ground not found");
  return ground;
}
