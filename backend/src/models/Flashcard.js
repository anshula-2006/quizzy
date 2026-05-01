import mongoose from "mongoose";

const flashcardSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, index: true },
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

export const Flashcard = mongoose.models.Flashcard || mongoose.model("Flashcard", flashcardSchema);
