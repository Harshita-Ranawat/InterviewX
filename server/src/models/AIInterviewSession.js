import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "assistant", "system"], required: true },
  content: { type: String, required: true },
  at: { type: Date, default: Date.now },
});

const aiInterviewSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    topic: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["active", "completed", "abandoned"],
      default: "active",
    },
    messages: [messageSchema],
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: "AIInterviewReport", default: null },
  },
  { timestamps: true }
);

export const AIInterviewSession = mongoose.model("AIInterviewSession", aiInterviewSessionSchema);
