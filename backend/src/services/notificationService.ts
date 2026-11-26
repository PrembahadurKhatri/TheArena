import { Types } from "mongoose";
import { Notification, NotificationType } from "../models/Notification";
import { Announcement, ANNOUNCEMENT_AUDIENCES, AnnouncementAudience } from "../models/Announcement";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { isObjectIdString, requireString } from "../utils/validation";
import { Page, pageMeta } from "../utils/pagination";
import { audit } from "./auditService";
import { sendEmail } from "../utils/sendEmail";
import { getPrimaryClientUrl } from "../config/env";

// Notification types worth an email as well as the in-app notification.
const EMAIL_TYPES = new Set<NotificationType>([
  "team.invitation",
  "challenge.received",
  "challenge.accepted",
  "match.report_submitted",
  "match.report_disputed",
  "tournament.review",
  "booking.cancelled",
  "order.placed",
  "order.status",
  "merchant.review",
  "ground.review",
  "subscription.expiring",
  "account.status",
]);

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Email channel. Runs only when SMTP is configured, for important types, to
 * users who haven't turned email off. Never blocks or fails the caller.
 */
async function emailChannel(recipients: string[], input: NotifyInput) {
  if (!process.env.SMTP_HOST || !EMAIL_TYPES.has(input.type)) return;
  const { User } = await import("../models/User");
  const users = await User.find({ _id: { $in: recipients }, status: "active", "privacy.emailNotifications": { $ne: false } }).select("email name").lean();
  const link = input.link ? `${getPrimaryClientUrl()}${input.link}` : getPrimaryClientUrl();
  await Promise.all(
    users.map((u) =>
      sendEmail({
        to: u.email,
        subject: input.title,
        text: `${input.title}${input.body ? `\n\n${input.body}` : ""}\n\n${link}\n\nYou can turn these emails off in your privacy settings.`,
        html: `<p><strong>${escapeHtml(input.title)}</strong></p>${input.body ? `<p>${escapeHtml(input.body)}</p>` : ""}<p><a href="${link}">Open The Arena</a></p><p style="color:#888;font-size:12px">You can turn these emails off in your privacy settings.</p>`,
      }).catch((err) => console.error("[notify] email failed:", err?.message ?? err))
    )
  );
}

type Id = Types.ObjectId | string | { _id: Types.ObjectId | string };

/** An id from an ObjectId, a string, or a populated document. */
function toId(r: Id): string {
  return r && typeof r === "object" && "_id" in r ? String(r._id) : String(r);
}

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  entity?: { type: string; id: Id | null };
  actor?: Id | null;
}

/**
 * Send an in-app notification to one or more users. Never throws: a failed
 * notification must not undo the action that caused it. The actor is never
 * notified about their own action.
 *
 * Channels: in-app today. Email and push plug in here later (see
 * docs/MASTER_PLAN.md, Phase 10) without changing any caller.
 */
export async function notify(recipients: Id | null | undefined | (Id | null | undefined)[], input: NotifyInput) {
  const list = (Array.isArray(recipients) ? recipients : [recipients])
    .filter((r): r is Id => !!r)
    .map(toId);
  const actor = input.actor ? toId(input.actor) : null;
  const unique = [...new Set(list)].filter((r) => r !== actor);
  if (unique.length === 0) return 0;
  try {
    const saved = await Notification.insertMany(
      unique.map((recipient) => ({
        recipient,
        type: input.type,
        title: input.title.slice(0, 160),
        body: input.body?.slice(0, 1000),
        link: input.link,
        entity: input.entity ? { type: input.entity.type, id: input.entity.id ?? null } : undefined,
        actor,
      })),
      { ordered: false }
    );
    // Email goes out in the background; the request doesn't wait for SMTP.
    if (saved.length) void emailChannel(unique, input).catch(() => undefined);
    // With ordered: false, invalid documents are skipped rather than thrown.
    return saved.length;
  } catch (err: any) {
    console.error(`[notify] failed to send ${input.type}:`, err?.message ?? err);
    return 0;
  }
}

function toNotificationJSON(n: any) {
  return {
    id: n._id.toString(),
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
    entity: n.entity?.type ? { type: n.entity.type, id: n.entity.id ? n.entity.id.toString() : null } : null,
    actor: n.actor && n.actor._id ? { id: n.actor._id.toString(), name: n.actor.name, photo: n.actor.photo ?? null } : null,
    read: !!n.readAt,
    readAt: n.readAt ?? null,
    createdAt: n.createdAt,
  };
}

export async function listMine(user: IUser, query: Record<string, unknown>, p: Page) {
  const filter: any = { recipient: user._id };
  if (query.unread === "true" || query.unread === "1") filter.readAt = null;
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate("actor", "name photo").lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: user._id, readAt: null }),
  ]);
  return { notifications: items.map(toNotificationJSON), unread, ...pageMeta(p, total) };
}

export async function unreadCount(user: IUser) {
  return { unread: await Notification.countDocuments({ recipient: user._id, readAt: null }) };
}

export async function markRead(user: IUser, id: string) {
  if (!isObjectIdString(id)) throw new AppError(400, "Invalid id");
  const n = await Notification.findOneAndUpdate(
    { _id: id, recipient: user._id },
    { $set: { readAt: new Date() } },
    { new: true }
  ).lean();
  if (!n) throw new AppError(404, "Notification not found");
  return toNotificationJSON(n);
}

export async function markAllRead(user: IUser) {
  const res = await Notification.updateMany({ recipient: user._id, readAt: null }, { $set: { readAt: new Date() } });
  return { updated: res.modifiedCount };
}

// ---------------------------------------------------------------- announcements

function toAnnouncementJSON(a: any) {
  return {
    id: a._id.toString(),
    title: a.title,
    body: a.body,
    audience: a.audience,
    publishedAt: a.publishedAt,
    expiresAt: a.expiresAt ?? null,
  };
}

/** Live announcements for the public / signed-in feed. */
export async function listAnnouncements(audiences: AnnouncementAudience[] = ["all", "players"]) {
  const now = new Date();
  const items = await Announcement.find({
    audience: { $in: audiences },
    publishedAt: { $lte: now },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  })
    .sort({ publishedAt: -1 })
    .limit(20)
    .lean();
  return items.map(toAnnouncementJSON);
}

function parseAnnouncement(input: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  if (!partial || input.title !== undefined) out.title = requireString(input.title, "title", { min: 3, max: 160 });
  if (!partial || input.body !== undefined) out.body = requireString(input.body, "body", { min: 3, max: 4000 });
  if (input.audience !== undefined) {
    if (!(ANNOUNCEMENT_AUDIENCES as readonly string[]).includes(String(input.audience))) {
      throw new AppError(400, `audience must be one of: ${ANNOUNCEMENT_AUDIENCES.join(", ")}`);
    }
    out.audience = input.audience;
  }
  for (const key of ["publishedAt", "expiresAt"] as const) {
    if (input[key] === undefined) continue;
    if (input[key] === null || input[key] === "") {
      if (key === "expiresAt") out.expiresAt = null;
      continue;
    }
    const d = new Date(String(input[key]));
    if (Number.isNaN(d.getTime())) throw new AppError(400, `${key} is not a valid date`);
    out[key] = d;
  }
  return out;
}

export async function adminListAnnouncements(p: Page) {
  const [items, total] = await Promise.all([
    Announcement.find().sort({ publishedAt: -1 }).skip(p.skip).limit(p.limit).populate("createdBy", "name").lean(),
    Announcement.countDocuments(),
  ]);
  return {
    announcements: items.map((a: any) => ({ ...toAnnouncementJSON(a), createdBy: a.createdBy ? { id: a.createdBy._id.toString(), name: a.createdBy.name } : null })),
    ...pageMeta(p, total),
  };
}

export async function createAnnouncement(actor: IUser, input: Record<string, unknown>) {
  const data = parseAnnouncement(input, false);
  const a = await Announcement.create({ ...data, createdBy: actor._id });
  await audit({ actor: actor._id, actorRole: actor.role, action: "announcement.created", target: { type: "announcement", id: a._id }, after: { title: a.title, audience: a.audience } });
  return toAnnouncementJSON(a);
}

export async function updateAnnouncement(actor: IUser, id: string, input: Record<string, unknown>) {
  if (!isObjectIdString(id)) throw new AppError(400, "Invalid id");
  const data = parseAnnouncement(input, true);
  const a = await Announcement.findByIdAndUpdate(id, { $set: data }, { new: true });
  if (!a) throw new AppError(404, "Announcement not found");
  await audit({ actor: actor._id, actorRole: actor.role, action: "announcement.updated", target: { type: "announcement", id: a._id }, after: data });
  return toAnnouncementJSON(a);
}

export async function deleteAnnouncement(actor: IUser, id: string) {
  if (!isObjectIdString(id)) throw new AppError(400, "Invalid id");
  const a = await Announcement.findByIdAndDelete(id);
  if (!a) throw new AppError(404, "Announcement not found");
  await audit({ actor: actor._id, actorRole: actor.role, action: "announcement.deleted", target: { type: "announcement", id: a._id }, before: { title: a.title } });
  return { message: "Announcement deleted" };
}

