import mongoose from "mongoose";

/** Outgoing SMTP for interview invites (each host uses their own mailbox). passEnc is AES-GCM; omit from queries unless +inviteSmtp.passEnc */
const inviteSmtpSchema = new mongoose.Schema(
  {
    host: { type: String, default: "" },
    port: { type: Number, default: 587 },
    secure: { type: Boolean, default: false },
    user: { type: String, default: "" },
    passEnc: { type: String, default: "", select: false },
    fromAddress: { type: String, default: "" },
  },
  { _id: false }
);

/** Gmail API (OAuth) for invites — no manual SMTP. refreshTokenEnc uses same secret as SMTP password. */
const gmailInviteSchema = new mongoose.Schema(
  {
    refreshTokenEnc: { type: String, default: "", select: false },
    sendAsEmail: { type: String, default: "" },
    connectedAt: { type: Date },
  },
  { _id: false }
);

const gmailLinkPendingSchema = new mongoose.Schema(
  {
    state: { type: String, default: "" },
    expiresAt: { type: Date },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    displayName: { type: String, default: "" },
    photoURL: { type: String, default: "" },
    /** Single app role — all accounts are users */
    role: { type: String, default: "user" },
    lastLoginAt: { type: Date },
    inviteSmtp: { type: inviteSmtpSchema, default: undefined },
    gmailInvite: { type: gmailInviteSchema, default: undefined },
    gmailLinkPending: { type: gmailLinkPendingSchema, default: undefined },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
