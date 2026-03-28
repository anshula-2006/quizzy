import mongoose from "mongoose";

const savedQuestionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    question: { type: String, required: true },
    correct: { type: String, default: "" },
    explanation: { type: String, default: "" },
    image: { type: String, default: null }
  },
  { timestamps: true }
);

savedQuestionSchema.index({ user: 1, question: 1, correct: 1 }, { unique: true });

export const SavedQuestion = mongoose.models.SavedQuestion || mongoose.model("SavedQuestion", savedQuestionSchema);
