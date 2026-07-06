import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createServer } from "http";
import WebSocket from "ws";
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
const server = createServer(app);
const wss = new WebSocket.Server({ noServer: true });

// Handle WebSocket upgrades
server.on("upgrade", (request, socket, head) => {
  const urlObj = new URL(request.url || "", `http://${request.headers.host}`);
  const pathname = urlObj.pathname;

  if (pathname.startsWith("/api/v1/live-interview/")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Setup simulated conversation logs if keys are missing
function setupSimulatedDialog(interviewId: string, githubMetadata: any) {
  const username = githubMetadata?.username || "Candidate";
  const repos = githubMetadata?.repos || [];
  
  const simulatedQuestions = [
    `Welcome to the interview, ${username}! I see in your GitHub profile that you have a repository named '${repos[0]?.name || "e-commerce-backend"}'. Could you describe the core architectural decisions you made there?`,
    `That is interesting. When developing systems with those technologies, how do you handle asynchronous database queries or transaction safety, particularly under high concurrent loads?`,
    `Excellent points. Regarding your database design, what strategies do you employ for indexing, query performance optimization, and schema migrations?`,
    `Great. Thank you for your time today. I will wrap up our conversation and process your full evaluation. Good luck!`,
  ];

  let questionIndex = 0;

  // Insert initial question in DB after 2.5 seconds
  setTimeout(async () => {
    try {
      await Message.create({
        interviewId,
        role: "Assistant",
        content: simulatedQuestions[0],
      });
      questionIndex++;
      console.log(`🤖 Simulated question 1 inserted for interview ${interviewId}`);
    } catch (err) {
      console.error("Failed to insert simulated question:", err);
    }
  }, 2500);

  const intervalId = setInterval(async () => {
    try {
      const interview = await Interview.findByPk(interviewId);
      if (!interview || interview.status === "Done" || questionIndex >= simulatedQuestions.length) {
        clearInterval(intervalId);
        return;
      }

      const messages = await Message.findAll({
        where: { interviewId },
        order: [["createdAt", "ASC"]],
      });

      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === "User") {
          const nextQuestion = simulatedQuestions[questionIndex];
          questionIndex++;

          setTimeout(async () => {
            await Message.create({
              interviewId,
              role: "Assistant",
              content: nextQuestion,
            });
            console.log(`🤖 Simulated question ${questionIndex} inserted.`);
          }, 2000);
        }
      }
    } catch (err) {
      console.error("Error in sideband simulation loop:", err);
    }
  }, 3000);
}

// Handle Gemini Live WebSocket proxy connections
wss.on("connection", async (ws, request) => {
  const urlObj = new URL(request.url || "", `http://${request.headers.host}`);
  const pathname = urlObj.pathname;
  const interviewId = pathname.split("/").pop() || "";

  console.log(`🔌 Client connected to live WebSocket. Interview ID: ${interviewId}`);

  try {
    const interview = await Interview.findByPk(interviewId);
    if (!interview) {
      ws.close(4004, "Interview not found");
      return;
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      console.warn("⚠️ GEMINI_API_KEY not configured. Activating client simulation mode.");
      ws.send(JSON.stringify({ type: "ready", isMock: true }));
      setupSimulatedDialog(interviewId, interview.githubMetadata);
      return;
    }

    // Connect to Gemini Live WebSocket
    const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${geminiKey}`;
    const geminiWs = new WebSocket(geminiUrl);

    geminiWs.on("open", () => {
      console.log("✅ Connected to Gemini Multimodal Live API WebSocket.");
      
      const repos = interview.githubMetadata?.repos || [];
      const reposText = repos
        .map((r: any) => `- Name: ${r.name}, Language: ${r.language}, Stars: ${r.stars}. Description: ${r.description}`)
        .join("\n");

      const systemPrompt = `
You are a senior technical interviewer. You are conducting an interactive technical and systems design voice interview with the candidate.
The candidate's GitHub repositories:
${reposText}

Instructions:
- Speak concisely. Ask technical questions based on these technologies.
- Maintain a professional and helpful tone.
- Ask one question at a time.
- Start by welcoming the candidate and asking them about their background.
`;

      const setupMsg = {
        setup: {
          model: "models/gemini-2.0-flash-exp",
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Aoede" // Voices: Aoede, Puck, Charon, Kore, Fenrir
                }
              }
            }
          },
          systemInstruction: {
            parts: [
              { text: systemPrompt }
            ]
          }
        }
      };

      geminiWs.send(JSON.stringify(setupMsg));
      ws.send(JSON.stringify({ type: "ready", isMock: false }));
    });

    ws.on("message", (message) => {
      try {
        const payload = JSON.parse(message.toString());
        if (payload.type === "audio" && geminiWs.readyState === WebSocket.OPEN) {
          const clientChunk = {
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: "audio/pcm",
                  data: payload.data
                }
              ]
            }
          };
          geminiWs.send(JSON.stringify(clientChunk));
        } else if (payload.type === "text" && geminiWs.readyState === WebSocket.OPEN) {
          const clientText = {
            realtimeInput: {
              parts: [
                { text: payload.data }
              ]
            }
          };
          geminiWs.send(JSON.stringify(clientText));
        }
      } catch (err) {
        console.error("Error forwarding message to Gemini:", err);
      }
    });

    geminiWs.on("message", async (data) => {
      try {
        const response = JSON.parse(data.toString());

        if (response.serverContent?.modelTurn?.parts) {
          for (const part of response.serverContent.modelTurn.parts) {
            if (part.inlineData?.data) {
              ws.send(JSON.stringify({
                type: "audio",
                data: part.inlineData.data
              }));
            }

            if (part.text) {
              console.log(`💬 Gemini transcript segment: "${part.text}"`);
              await Message.create({
                interviewId,
                role: "Assistant",
                content: part.text
              });
            }
          }
        }
      } catch (err) {
        console.error("Error reading response from Gemini:", err);
      }
    });

    geminiWs.on("close", () => {
      console.log("🔌 Gemini Live API WebSocket disconnected.");
      ws.close(1000, "Gemini session ended");
    });

    geminiWs.on("error", (err) => {
      console.error("❌ Gemini Live WS error:", err);
      ws.send(JSON.stringify({ type: "error", message: "Gemini connection error" }));
    });

    ws.on("close", () => {
      geminiWs.close();
      console.log(`🔌 Client Live WebSocket disconnected for call: ${interviewId}`);
    });

  } catch (error) {
    console.error("Error during WebSocket setup:", error);
    ws.close(1011, "Setup internal error");
  }
});

async function startServer() {
  try {
    await initDb();
    server.listen(PORT, () => {
      console.log(`🚀 FastInterview Backend running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Fatal error during backend server startup:", error);
    process.exit(1);
  }
}

startServer();
