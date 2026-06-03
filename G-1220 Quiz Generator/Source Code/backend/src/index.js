import { app } from "./app.js";
import { connectDatabase } from "./config/db.js";
import { env } from "./config/env.js";

connectDatabase().catch((error) => {
  console.error("MongoDB connection error:", error.message);
});

app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`);
});
