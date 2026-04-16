import mongoose from "mongoose";

const scoreSchema = new mongoose.Schema({
  communication: { type: Number, min: 0, max: 10 },
  technicalDepth: { type: Number, min: 0, max: 10 },
  problemSolving: { type: Number, min: 0, max: 10 },
  structure: { type: Number, min: 0, max: 10 },
});

const aiInterviewReportSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AIInterviewSession",
      required: true,
      unique: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    topic: { type: String, required: true },
    summary: { type: String, required: true },
    strengths: [{ type: String }],
    improvements: [{ type: String }],
    sampleBetterAnswers: [{ type: String }],
    scores: scoreSchema,
    overallScore: { type: Number, min: 0, max: 10 },
    recommendations: { type: String, default: "" },
    rawModelOutput: { type: String, default: "" },
  },
  { timestamps: true }
);

export const AIInterviewReport = mongoose.model("AIInterviewReport", aiInterviewReportSchema);
