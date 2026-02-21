import express from "express";
import cors from "cors";
import Groq from "groq-sdk";

const app = express();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "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"
});

app.post("/generate-quiz", async (req, res) => {
  const { text, topic } = req.body;

  if (!text && !topic) {
    return res.status(400).json({ error: "Text or topic is required" });
  }

  const variation = Math.floor(Math.random() * 100000);

  let prompt = "";

prompt = `
Generate exactly 10 multiple-choice questions in JSON format.

Return ONLY valid JSON. No extra text.

Format:
{
  "questions": [
    {
      "question": "Clear and factually accurate question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": "A",
      "explanation": "2–3 sentence clear explanation justifying why this option is correct",
      "image": "Direct Wikimedia Commons image URL ending with .jpg or .png, or null"
    }
  ]
}

Rules:
- Questions must be FACTUALLY CORRECT
- Verify answers logically before choosing the correct option
- Avoid opinion-based or ambiguous questions
- Explanation must be at least 2 sentences
- Explanation must clearly justify the correct answer
- Do NOT guess facts
- If unsure about accuracy, choose a safer factual question

- Generate a DIFFERENT set of questions every time.
- Avoid repeating previously common questions.
- Be creative and vary phrasing.

Variation ID: ${variation}
- Image rules:
  - Image URL must start with https://upload.wikimedia.org/
  - Image URL must end with .jpg or .png
  - If no valid image exists, return null

Topic: "${topic || "hard"}"
Content: ${text || "Use general knowledge"}
`;



  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",   //  change ONLY this if needed
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9
    });

const rawOutput = completion.choices[0].message.content;

try {
  const firstBrace = rawOutput.indexOf("{");
  const lastBrace = rawOutput.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No JSON found");
  }

  const jsonString = rawOutput.slice(firstBrace, lastBrace + 1);
  const parsedOutput = JSON.parse(jsonString);

  res.json(parsedOutput);
} catch (err) {
  console.error("JSON Parse Error:", rawOutput);
  res.status(500).json({
    error: "AI returned invalid JSON"
  });
}


  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
