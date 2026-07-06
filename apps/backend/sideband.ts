import WebSocket from "ws";
import { Message } from "./models/Message";
import { Interview } from "./models/Interview";

export function setupOpenAISideband(callId: string, interviewId: string, githubMetadata: any) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn("⚠️ OPENAI_API_KEY not configured. Running WebSocket sideband in simulation mode.");
    startSimulationMode(interviewId, githubMetadata);
    return;
  }

  const wsUrl = `wss://api.openai.com/v1/realtime?call_id=${callId}`;
  console.log(`🔌 Connecting to OpenAI Realtime WS Sideband: ${wsUrl}`);

  const ws = new WebSocket(wsUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  ws.on("open", () => {
    console.log("✅ Connected to OpenAI Realtime sideband session.");

    // Format GitHub metadata for instructions
    const reposText = (githubMetadata.repos || [])
      .map((r: any) => `- Name: ${r.name}, Lang: ${r.language}, Stars: ${r.stars}. Desc: ${r.description}`)
      .join("\n");

    const systemInstructions = `
You are a senior technical interviewer conducting a coding and systems design chat.
The candidate's GitHub repositories list is as follows:
${reposText}

Please ask technical questions related to these technologies or general engineering best practices. Maintain a helpful yet rigorous tone. Ask one concise question at a time.
`;

    // Send session update configuration
    const updateEvent = {
      type: "session.update",
      session: {
        modalities: ["audio", "text"],
        instructions: systemInstructions,
        voice: "alloy",
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",
      },
    };

    ws.send(JSON.stringify(updateEvent));
  });

  ws.on("message", async (data) => {
    try {
      const event = JSON.parse(data.toString());
      console.log(`📬 OpenAI Event received: ${event.type}`);

      // Capture final agent response transcript and save to database
      if (event.type === "response.done" && event.response?.output) {
        for (const outputItem of event.response.output) {
          if (outputItem.type === "message" && outputItem.content) {
            for (const contentItem of outputItem.content) {
              if (contentItem.type === "text" && contentItem.text) {
                console.log(`💬 Assistant Response text: "${contentItem.text}"`);
                
                await Message.create({
                  interviewId,
                  role: "Assistant",
                  content: contentItem.text,
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("❌ Error parsing sideband WebSocket message:", err);
    }
  });

  ws.on("error", (error) => {
    console.error(`❌ OpenAI Realtime WS Error:`, error);
  });

  ws.on("close", (code, reason) => {
    console.log(`🔌 OpenAI Realtime WS closed. Code: ${code}, Reason: ${reason.toString() || "None"}`);
  });
}

/**
 * Simulates conversational responses from the AI interviewer to populate 
 * messages in the database if there is no OpenAI Key during testing.
 */
function startSimulationMode(interviewId: string, githubMetadata: any) {
  const username = githubMetadata.username || "Candidate";
  const repos = githubMetadata.repos || [];
  
  // Set up sequential interview questions to auto-respond
  const simulatedQuestions = [
    `Welcome to the interview, ${username}! I see in your GitHub profile that you have a repository named '${repos[0]?.name || "e-commerce-backend"}'. Could you describe the core architectural decisions you made there?`,
    `That is interesting. When developing systems with those technologies, how do you handle asynchronous database queries or transaction safety, particularly under high concurrent loads?`,
    `Excellent points. Regarding your database design, what strategies do you employ for indexing, query performance optimization, and schema migrations?`,
    `Great. Thank you for your time today. I will wrap up our conversation and process your full evaluation. Good luck!`,
  ];

  let questionIndex = 0;

  // Insert initial question in DB after 3 seconds
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
  }, 3000);

  // Set up a listener wrapper to simulate follow-ups when user responds
  // We check periodically for user answers to trigger next simulated question
  const intervalId = setInterval(async () => {
    try {
      const interview = await Interview.findByPk(interviewId);
      if (!interview || interview.status === "Done" || questionIndex >= simulatedQuestions.length) {
        clearInterval(intervalId);
        return;
      }

      // Check messages
      const messages = await Message.findAll({
        where: { interviewId },
        order: [["createdAt", "ASC"]],
      });

      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        // If last message is from user, wait 2 seconds and insert next question
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
