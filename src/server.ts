import "dotenv/config";

import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 5000;

const bootstrap = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log("TWO_FACTOR_API:", process.env.TWO_FACTOR_API);
    console.log("TEMPLATE_NAME:", process.env.TWO_FACTOR_TEMPLATE_NAME);
    console.log(
      "Loaded Stripe Key:",
      process.env.STRIPE_SECRET_KEY?.slice(0, 10)
    );
  });
};

bootstrap();
