import Notification from "@/models/Notification";
import ModerationAction from "@/models/ModerationAction";
import User from "@/models/User";
import Image from "@/models/Image";
import { renderTemplate } from "@/utils/notifTemplates";

const NOTIF_ENABLED = (process.env.NOTIF_ENABLED || "true") === "true";

async function getWarningCount(userId) {
  // 簡單做法：查歷史 ModerationAction WARN_* 筆數
  return await ModerationAction.countDocuments({
    targetUserId: userId,
    action: { $in: ["WARN_L1","WARN_L2","WARN_L3"] }
  });
}

export async function modRecategory({ operatorId, imageId, targetUserId, oldRating, newRating, reasonCode, reasonText }) {
  const image = await Image.findById(imageId);
  const user = await User.findById(targetUserId);

  const action = await ModerationAction.create({
    operatorId, targetUserId, imageId, action: "RECAT",
    reasonCode, reasonText, oldRating, newRating,
    templateKey: "recat.nsfw_to_sfw",
    snapshot: { imageTitle: image?.title, username: user?.username }
  });

  if (NOTIF_ENABLED) {
    const ctx = {
      user, image,
      oldRating, newRating,
      reason: reasonText || reasonCode,
      reasonCode,
      appealUrl: `${process.env.SITE_URL || ""}/appeal?ref=${action._id}`
    };
    const { title, body } = renderTemplate("recat.nsfw_to_sfw", ctx);
    await Notification.create({
      userId: targetUserId, type: "recategory", title, body,
      meta: { imageId, oldRating, newRating, reasonCode, actionId: action._id }
    });
  }

  return action;
}

export async function modTakedown({ operatorId, imageId, targetUserId, reasonCode, reasonText, warningLevel = 1 }) {
  const image = await Image.findById(imageId);
  const user = await User.findById(targetUserId);

  const action = await ModerationAction.create({
    operatorId, targetUserId, imageId, action: `WARN_L${warningLevel}`,
    reasonCode, reasonText, templateKey: "takedown.nsfw_in_sfw",
    snapshot: { imageTitle: image?.title, username: user?.username }
  });

  if (NOTIF_ENABLED) {
    const count = await getWarningCount(targetUserId);
    const ctx = {
      user, image,
      reason: reasonText || reasonCode, reasonCode,
      warning: { level: warningLevel, count },
      appealUrl: `${process.env.SITE_URL || ""}/appeal?ref=${action._id}`
    };
    const { title, body } = renderTemplate("takedown.nsfw_in_sfw", ctx);
    await Notification.create({
      userId: targetUserId, type: "takedown", title, body,
      meta: { imageId, warningLevel, reasonCode, actionId: action._id }
    });
  }

  // 這裡實際做「下架」：image.status = "removed" 之類
  if (image) {
    image.status = "removed";
    await image.save();
  }

  return action;
}

export async function modWarn({ operatorId, targetUserId, reasonCode, reasonText, level }) {
  const user = await User.findById(targetUserId);
  const action = await ModerationAction.create({
    operatorId, targetUserId, action: `WARN_L${level}`, reasonCode, reasonText,
    templateKey: `warn.level${level}`,
  });

  if (NOTIF_ENABLED) {
    const count = await getWarningCount(targetUserId);
    const key = `warn.level${level}`;
    const ctx = { user, reason: reasonText || reasonCode, reasonCode, warning: { level, count } };
    const { title, body } = renderTemplate(key, ctx);
    await Notification.create({
      userId: targetUserId, type: "warning", title, body,
      meta: { warningLevel: level, reasonCode, actionId: action._id }
    });
  }
  return action;
}
