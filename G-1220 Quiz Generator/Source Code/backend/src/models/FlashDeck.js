import mongoose from "mongoose";

const flashDeckSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "Study Deck" },
    sourceType: { type: String, default: "text" },
    flashcards: { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  { timestamps: true }
);

export const FlashDeck = mongoose.models.FlashDeck || mongoose.model("FlashDeck", flashDeckSchema);
