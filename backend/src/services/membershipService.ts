import { Membership } from "../models/Membership";
import { IUser } from "../models/User";

export async function getMyMembership(user: IUser) {
  const latest = await Membership.findOne({ user: user._id }).sort({ expiresAt: -1 });
  const isCurrentlyActive = !!user.isPremium && !!user.membershipExpiresAt && user.membershipExpiresAt > new Date();

  return {
    isPremium: !!user.isPremium,
    membershipExpiresAt: user.membershipExpiresAt ? new Date(user.membershipExpiresAt).toISOString() : null,
    activeMembership: isCurrentlyActive ? latest : null,
  };
}
