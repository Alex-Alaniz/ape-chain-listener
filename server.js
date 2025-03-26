import { connectToDatabase } from "./config/dbConfig.js";
import {
  fetchEventsForEvent,
  startLiveEventListeners,
} from "./eventListener.js";
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();

try {
  await connectToDatabase();
} catch {
  console.log("Error connecting database");
}

startLiveEventListeners();

// const START_BLOCK = 11621695;
// // const START_BLOCK = 11989695;
// const END_BLOCK = 12037211;

// (async () => {
//   try {
//     await fetchEventsForEvent(START_BLOCK, END_BLOCK);

//     console.log("All events fetched successfully");
//   } catch (error) {
//     console.error("Error fetching events:", error);
//   }
// })();

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => {
  console.log(`🚀 Server running on Port: ${PORT}`);
});
