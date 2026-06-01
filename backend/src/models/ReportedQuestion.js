import mongoose from "mongoose";

const reportedQuestionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userName: { type: String, default: "", trim: true },
    quizSession: { type: mongoose.Schema.Types.ObjectId, ref: "QuizSession", default: null, index: true },
    publishedQuizId: { type: String, default: "", index: true },
    teacherName: { type: String, default: "", trim: true },
    question: { type: String, required: true, trim: true },
    selected: { type: String, default: "", trim: true },
    correct: { type: String, default: "", trim: true },
    explanation: { type: String, default: "", trim: true },
    reason: { type: String, default: "Answer seems incorrect", trim: true },
    status: { type: String, enum: ["open", "reviewed"], default: "open", index: true }
  },
  { timestamps: true }
);

export const ReportedQuestion = mongoose.models.ReportedQuestion || mongoose.model("ReportedQuestion", reportedQuestionSchema);
