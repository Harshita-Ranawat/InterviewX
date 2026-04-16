import crypto from "crypto";

export function generateRoomCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export function generateInviteToken() {
  return crypto.randomBytes(24).toString("hex");
}
