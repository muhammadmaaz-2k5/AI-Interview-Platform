import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { initDb, Interview, Message } from "./models";
import { PreInterviewSchema } from "./types";
import { scrapeGitHubProfile } from "./scrapers/github";
import { setupOpenAISideband } from "./sideband";
import { calculateInterviewResult } from "./result";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 🧪 Status route
app.get("/api/v1/status", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// 1️⃣ Onboarding: Scrapes profile, creates interview record
app.post("/api/v1/pre-interview", async (req, res) => {
  try {
    const parseResult = PreInterviewSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { githubUrl } = parseResult.data;
    
    // Scrape repositories
    const githubMetadata = await scrapeGitHubProfile(githubUrl);

    // Create database record
    const interview = await Interview.create({
      githubUrl,
      githubMetadata,
      status: "Pre",
      score: null,
      feedback: null,
    });

    return res.status(201).json(interview);
  } catch (error: any) {
    console.error("Error in pre-interview onboarding:", error);
    return res.status(500).json({ error: "Failed to initialize interview" });
  }
});

// 2️⃣ Start Live Session: Proxies WebRTC offer to OpenAI or activates simulation
app.post("/api/v1/session/:id", async (req, res) => {
  const { id } = req.params;
  const { sdp } = req.body; // Browser WebRTC SDP Offer

  try {
    const interview = await Interview.findByPk(id);
    if (!interview) {
      return res.status(404).json({ error: "Interview session not found" });
    }

    interview.status = "In-Progress";
    await interview.save();

    // Check OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("⚠️ No OpenAI API key. Bypassing WebRTC connection to return simulator state.");
      
      // Start simulation loop in the background
      setupOpenAISideband("sim-call-id", id, interview.githubMetadata);
      
      return res.json({
        sdp: null,
        isMock: true,
        message: "Developer simulation activated. Frontend will run speech simulation without WebRTC headers.",
      });
    }

    // Proxy SDP offer to OpenAI Realtime WebRTC endpoint
    console.log(`🌐 Proxying WebRTC SDP offer to OpenAI for call: ${id}`);
    
    // Default model for WebRTC Audio
    const model = "gpt-4o-realtime-preview-2024-12-17";
    const response = await axios.post(
      `https://api.openai.com/v1/realtime/calls?model=${model}`,
      sdp,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/sdp",
        },
        timeout: 10000,
      }
    );

    const sdpAnswer = response.data;
    
    // Retrieve call_id from response Location header to bind the Sideband WebSocket connection
    const locationHeader = response.headers["location"];
    let callId = "unknown";
    if (locationHeader) {
      const parts = locationHeader.split("/");
      callId = parts[parts.length - 1];
    }
    
    console.log(`📡 OpenAI call ID established: ${callId}. Starting sideband listener.`);
    
    // Connect WebSocket sideband to inject system prompts and capture audio output transcripts
    setupOpenAISideband(callId, id, interview.githubMetadata);

    return res.json({
      sdp: sdpAnswer,
      isMock: false,
    });
  } catch (error: any) {
    console.error("Error establishing session with OpenAI WebRTC:", error.response?.data || error.message);
    return res.status(500).json({ error: "Failed to connect audio streaming proxy" });
  }
});

// 3️⃣ Capture Transcript chunks from client side
app.post("/api/v1/session/user/response/:id", async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content || typeof content !== "string") {
    return res.status(400).json({ error: "Message content must be a non-empty string" });
  }

  try {
    const interview = await Interview.findByPk(id);
    if (!interview) {
      return res.status(404).json({ error: "Interview session not found" });
    }

    const message = await Message.create({
      interviewId: id,
      role: "User",
      content,
    });

    return res.status(201).json(message);
  } catch (error: any) {
    console.error("Error saving user message chunk:", error);
    return res.status(500).json({ error: "Failed to store message transcript" });
  }
});

// 4️⃣ Evaluation & Result summary
app.get("/api/v1/result/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const evaluatedInterview = await calculateInterviewResult(id);
    return res.json(evaluatedInterview);
  } catch (error: any) {
    console.error("Error analyzing interview result:", error);
    return res.status(500).json({ error: error.message || "Failed to analyze interview" });
  }
});

// 🚀 Start Server
async function startServer() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`🚀 AI Interview Platform Backend running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Fatal error during backend server startup:", error);
    process.exit(1);
  }
}

startServer();
