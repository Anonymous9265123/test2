require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

const MONGO_URI = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());

if (!MONGO_URI) {
  console.error("MONGO_URI is not defined in .env file");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

// Updated User schema
const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  totalClicks: { type: Number, default: 0 },
  currentClicks: { type: Number, default: 0 },
  lastSavedClicks: { type: Number, default: 0 },
  clickChunks: [{ type: Number }],
  lastUpdated: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);

// API endpoint to get user data
app.get("/api/user", async (req, res) => {
  const { telegramId } = req.query;

  try {
    const user = await User.findOne({ telegramId });
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// API endpoint to update user clicks
app.post("/api/clicks", async (req, res) => {
  const { telegramId, name, clicks } = req.body;

  try {
    let user = await User.findOne({ telegramId });

    if (!user) {
      user = new User({ telegramId, name, currentClicks: clicks });
    } else {
      user.currentClicks += clicks;
      user.name = name; // Update name in case it changed
    }

    user.lastUpdated = new Date();
    await user.save();

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Function to save clicks periodically
const saveClicksPeriodically = async () => {
  try {
    const users = await User.find({});

    for (const user of users) {
      const clicksToAdd = user.currentClicks - user.lastSavedClicks;

      if (clicksToAdd > 0) {
        user.totalClicks += clicksToAdd;
        user.clickChunks.push(clicksToAdd);
        user.lastSavedClicks = user.currentClicks;

        // Keep only the last 100 chunks
        if (user.clickChunks.length > 100) {
          user.clickChunks = user.clickChunks.slice(-100);
        }

        await user.save();
      }
    }

    console.log("Clicks updated in the database");
  } catch (error) {
    console.error("Error updating clicks:", error);
  }
};

// Save clicks every 10 seconds
setInterval(saveClicksPeriodically, 10000);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
