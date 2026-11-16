import { Ground } from "../models/Ground";
import { AppError } from "../utils/AppError";
import { searchRegex } from "../utils/validation";

export async function listGrounds(filters: { sport?: string; search?: string }) {
  const query: any = {};
  if (filters.sport) query.sport = filters.sport;
  const nameRegex = searchRegex(filters.search);
  if (nameRegex) query.name = nameRegex;
  return Ground.find(query).sort({ createdAt: -1 });
}

export async function getGroundById(id: string) {
  const ground = await Ground.findById(id);
  if (!ground) throw new AppError(404, "Ground not found");
  return ground;
}
