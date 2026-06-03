import mongoose from "mongoose";

const publishedQuizSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    teacherName: { type: String, default: "", trim: true },
    title: { type: String, required: true, trim: true },
    sourceType: { type: String, default: "topic" },
    sourceInput: { type: String, default: "" },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    questions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    isGlobal: { type: Boolean, default: true, index: true },
    publishedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const PublishedQuiz = mongoose.models.PublishedQuiz || mongoose.model("PublishedQuiz", publishedQuizSchema);
