import mongoose from "mongoose";

const participantSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  /** host = organizer; candidate = guest. "interviewer" kept only for legacy DB rows. */
  role: { type: String, enum: ["host", "candidate", "interviewer"], default: "candidate" },
  joinedAt: { type: Date },
});

const inviteSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true },
  token: { type: String, required: true, index: true },
  status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
});

export const DEFAULT_CODING_STARTER = `// Shared live coding pad
function hello() {
  return "hi";
}
`;

const interviewSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 60 },
    hostUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    participants: [participantSchema],
    invites: [inviteSchema],
    roomCode: { type: String, required: true, unique: true, index: true },
    /** coding = shared editor; face_to_face = video only */
    interviewFormat: {
      type: String,
      enum: ["coding", "face_to_face"],
      default: "coding",
    },
    codingStarterCode: { type: String, default: "" },
    status: {
      type: String,
      /** `completed` kept only for legacy DB rows — the app no longer sets or surfaces it. */
      enum: ["scheduled", "live", "completed", "cancelled"],
      default: "scheduled",
    },
    recordingUrl: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Interview = mongoose.model("Interview", interviewSchema);
