import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { VoiceOrb } from "./VoiceOrb";
import { Mic, MicOff, PhoneOff, Send, Volume2, ShieldAlert } from "lucide-react";
import { toast, Toaster } from "sonner";

export function Interview() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();

  const [status, setStatus] = useState<"idle" | "speaking" | "listening" | "disconnected">("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0);
  const [interviewerText, setInterviewerText] = useState("Establishing secure streaming connection...");
  const [typedResponse, setTypedResponse] = useState("");
  const [isMockMode, setIsMockMode] = useState(false);
  const [githubUser, setGithubUser] = useState("");

  // Refs for audio API and connections
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const deepgramWsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null); // Browser native SpeechRecognition
  
  // Ref to track read message IDs to avoid repeating speech
  const spokenMessagesRef = useRef<Set<string>>(new Set());
  const speakerTimeoutRef = useRef<any>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);

  useEffect(() => {
    // 1️⃣ Fetch interview details to get GitHub context
    async function fetchInterviewDetails() {
      try {
        const res = await fetch(`/api/v1/result/${interviewId}`);
        if (res.ok) {
          const data = await res.ok ? await res.json() : null;
          if (data && data.githubMetadata) {
            setGithubUser(data.githubMetadata.username || "Candidate");
          }
        }
      } catch (err) {}
    }
    fetchInterviewDetails();

    // 2️⃣ Start WebRTC/Simulation setup
    startSession();

    return () => {
      cleanup();
    };
  }, [interviewId]);

  // Main session initializer using direct WebSocket stream to backend for Gemini Live API
  const startSession = async () => {
    try {
      // Get audio permissions
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      // Start volume analyser
      setupVolumeAnalyser(stream);

      // Determine WebSocket protocol and target URL (connect directly to port 3001)
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const backendHost = window.location.hostname;
      const wsUrl = `${wsProtocol}//${backendHost}:3001/api/v1/live-interview/${interviewId}`;

      console.log(`🔌 Connecting to backend Live WebSocket: ${wsUrl}`);
      const socket = new WebSocket(wsUrl);
      deepgramWsRef.current = socket;

      socket.onopen = () => {
        console.log("✅ Live WebSocket connection established.");
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.type === "ready") {
            if (payload.isMock) {
              setIsMockMode(true);
              setStatus("idle");
              setInterviewerText(`Greeting candidate... Welcome to your interview simulation.`);
              toast.info("Gemini Live API key missing. Mock simulation activated.", { duration: 5000 });
              setupSimulationMode();
            } else {
              setStatus("listening");
              setInterviewerText("Connected to Gemini Live. Start speaking to begin the interview.");
              toast.success("Connected to Gemini Live API.");
              setupGeminiMicCapture(stream, socket);
            }
          } else if (payload.type === "audio") {
            playPcmChunk(payload.data);
          } else if (payload.type === "error") {
            toast.error(`Gemini Error: ${payload.message}`);
          }
        } catch (e) {
          console.error("Error reading WebSocket packet:", e);
        }
      };

      socket.onerror = (err) => {
        console.error("WebSocket connection error:", err);
        throw new Error("Failed to connect live WebSocket.");
      };

      socket.onclose = () => {
        console.log("WebSocket connection closed.");
      };

    } catch (err: any) {
      console.error(err);
      toast.error("Failed to connect mic or live session: " + err.message);
      setIsMockMode(true);
      setStatus("idle");
      setInterviewerText("Entering mock chat simulation mode (No Live/Microphone connection).");
      setupSimulationMode();
    }
  };

  // Set up volume analyser node
  const setupVolumeAnalyser = (stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!analyserRef.current || isMuted) {
          if (!isMuted) requestAnimationFrame(checkVolume);
          return;
        }
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normVolume = Math.min(1, average / 80); // scale appropriately
        
        // If we are listening, track candidate volume
        if (status === "listening") {
          setVolume(normVolume);
        }
        requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.error("Audio Context initialization failed:", e);
    }
  };

  // Helper to convert array buffer to base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // Helper to capture raw 16kHz PCM audio and send it to WebSocket
  const setupGeminiMicCapture = (stream: MediaStream, socket: WebSocket) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorNodeRef.current = processor;
      
      source.connect(processor);
      processor.connect(ctx.destination);
      
      processor.onaudioprocess = (e) => {
        if (isMuted) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Downsample input rate to 16kHz linear PCM
        const inputSampleRate = ctx.sampleRate;
        const outputSampleRate = 16000;
        const ratio = inputSampleRate / outputSampleRate;
        const outputLength = Math.round(inputData.length / ratio);
        const result = new Int16Array(outputLength);
        
        for (let i = 0; i < outputLength; i++) {
          const index = Math.round(i * ratio);
          const sample = Math.max(-1, Math.min(1, inputData[index]));
          result[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        
        if (socket.readyState === WebSocket.OPEN) {
          const base64Audio = arrayBufferToBase64(result.buffer);
          socket.send(JSON.stringify({ type: "audio", data: base64Audio }));
        }
      };
    } catch (e) {
      console.error("Failed to setup microphone capture node:", e);
    }
  };

  // Helper to play back 24kHz linear PCM audio chunks received from Gemini Live
  const playPcmChunk = (base64Data: string) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = ctx;

      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const int16Array = new Int16Array(bytes.buffer);
      const floatArray = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        floatArray[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, floatArray.length, 24000);
      audioBuffer.copyToChannel(floatArray, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      
      if (analyserRef.current) {
        source.connect(analyserRef.current);
      }
      
      // Calculate output speaking volume for VoiceOrb
      let sum = 0;
      for (let i = 0; i < floatArray.length; i++) {
        sum += Math.abs(floatArray[i]);
      }
      const avg = sum / floatArray.length;
      setVolume(Math.min(1, avg * 3.5));
      
      setStatus("speaking");
      if (speakerTimeoutRef.current) {
        clearTimeout(speakerTimeoutRef.current);
      }
      speakerTimeoutRef.current = setTimeout(() => {
        setStatus("listening");
        setVolume(0);
      }, 1000);
      
      source.start();
    } catch (e) {
      console.error("PCM playing error:", e);
    }
  };

  // Setup Deepgram WebSockets for Speech-to-Text streaming
  const setupDeepgramAudioStreaming = () => {
    try {
      const socket = new WebSocket("wss://api.deepgram.com/v1/listen", [
        "token",
        "DEEPGRAM_MOCK_FALLBACK", // Handled by standard socket
      ]);
      deepgramWsRef.current = socket;

      // In real scenarios, deepgram expects: wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000
      // We will fall back to native browser SpeechRecognition if socket cannot establish or key is missing
      socket.onerror = () => {
        console.warn("Deepgram socket connection failed. Using browser SpeechRecognition.");
        setupNativeSpeechRecognition();
      };
    } catch (e) {
      setupNativeSpeechRecognition();
    }
  };

  // Browser Native Web Speech API fallback
  const setupNativeSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("This browser does not support SpeechRecognition. Keyboard fallback enabled.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onresult = async (event: any) => {
      const lastIndex = event.results.length - 1;
      const resultText = event.results[lastIndex][0].transcript;
      if (resultText && resultText.trim()) {
        console.log(`🎙️ Native Transcribed: "${resultText}"`);
        await submitUserResponse(resultText);
      }
    };

    rec.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
    };

    rec.onend = () => {
      if (status === "listening" && !isMuted) {
        try { rec.start(); } catch (e) {} // Auto-restart while active
      }
    };

    recognitionRef.current = rec;
    rec.start();
  };

  // Submit candidate text answer to database
  const submitUserResponse = async (text: string) => {
    try {
      setStatus("idle");
      // Pre-display local text
      toast.info(`Candidate: "${text}"`, { duration: 3000 });
      
      const res = await fetch(`/api/v1/session/user/response/${interviewId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      if (!res.ok) {
        throw new Error("Failed to upload response");
      }

      // If we have an active WebSocket connection, send it to Gemini Live!
      if (deepgramWsRef.current && deepgramWsRef.current.readyState === WebSocket.OPEN && !isMockMode) {
        deepgramWsRef.current.send(JSON.stringify({ type: "text", data: text }));
      }
    } catch (err) {
      console.error("Error sending transcript response:", err);
      toast.error("Failed to transmit transcription to backend.");
    }
  };

  // Setup Simulation / Keyless Mode using Web Speech API
  const setupSimulationMode = () => {
    setupNativeSpeechRecognition();

    // Poll backend periodically for new Assistant questions to speak aloud
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/result/${interviewId}`);
        if (!res.ok) return;
        const data = await res.json();
        
        // Find latest Assistant message
        const messages = await fetchMessages();
        const assistantMsgs = messages.filter((m) => m.role === "Assistant");
        if (assistantMsgs.length > 0) {
          const latest = assistantMsgs[assistantMsgs.length - 1];
          
          if (!spokenMessagesRef.current.has(latest.id)) {
            spokenMessagesRef.current.add(latest.id);
            speakSimulatedQuestion(latest.content);
          }
        }
      } catch (err) {
        console.error("Simulation polling error:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  };

  // Fetch chronological messages
  const fetchMessages = async (): Promise<any[]> => {
    try {
      const res = await fetch(`/api/v1/result/${interviewId}`);
      if (res.ok) {
        const data = await res.json();
        return data.messages || [];
      }
    } catch (e) {}
    return [];
  };

  // Web Speech API text-to-speech engine for local demo
  const speakSimulatedQuestion = (text: string) => {
    if (!window.speechSynthesis) {
      setInterviewerText(text);
      setStatus("listening");
      return;
    }

    // Cancel anything playing
    window.speechSynthesis.cancel();
    
    setInterviewerText(text);
    setStatus("speaking");

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Attempt to pick a premium male/female english sounding voice
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural")));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    // Dynamic fake visual volume for VoiceOrb during speech
    let volInterval: any;
    utterance.onstart = () => {
      volInterval = setInterval(() => {
        setVolume(0.1 + Math.random() * 0.7);
      }, 100);
    };

    utterance.onend = () => {
      clearInterval(volInterval);
      setVolume(0);
      setStatus("listening");
      toast.success("AI finished speaking. Your turn to respond.");
    };

    utterance.onerror = () => {
      clearInterval(volInterval);
      setVolume(0);
      setStatus("listening");
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleSendTypedMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedResponse.trim()) return;

    const message = typedResponse.trim();
    setTypedResponse("");
    await submitUserResponse(message);
  };

  // Toggle Mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted; // toggles track state
      });
      setIsMuted(!isMuted);
      toast.info(isMuted ? "Microphone Unmuted" : "Microphone Muted");
    }
  };

  // End interview and request evaluation
  const handleEndInterview = async () => {
    setStatus("disconnected");
    toast.loading("Analyzing session logs and compiling feedback report...", { duration: 3000 });
    setTimeout(() => {
      navigate(`/result/${interviewId}`);
    }, 2000);
  };

  // Cleanup helper
  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (deepgramWsRef.current) {
      deepgramWsRef.current.close();
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
    }
    if (speakerTimeoutRef.current) {
      clearTimeout(speakerTimeoutRef.current);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col space-y-8 py-4 relative">
      <Toaster theme="dark" closeButton position="top-right" />
      
      {/* Background radial effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl -z-10 pulse-glow"></div>

      {/* Main Glass Panel */}
      <div className="glass-premium rounded-3xl p-6 md:p-8 shadow-2xl border border-zinc-800/60 relative overflow-hidden flex flex-col space-y-8">
        
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <div className="flex flex-col">
            <span className="text-xs uppercase font-bold text-zinc-500 tracking-widest">Live Session</span>
            <span className="text-sm font-semibold text-zinc-300">Target Candidate: {githubUser || "Loading..."}</span>
          </div>
          
          <div className="flex items-center gap-3">
            {isMockMode && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-xs font-semibold">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Simulation Active</span>
              </div>
            )}
            
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider ${
              status === "speaking"
                ? "bg-purple-500/15 border border-purple-500/30 text-purple-300"
                : status === "listening"
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                : "bg-zinc-800 border border-zinc-700 text-zinc-400"
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                status === "speaking"
                  ? "bg-purple-400 animate-pulse"
                  : status === "listening"
                  ? "bg-emerald-400 animate-ping"
                  : "bg-zinc-500"
              }`}></span>
              <span>{status === "speaking" ? "Interviewer Speaking" : status === "listening" ? "Listening to You" : "Processing"}</span>
            </div>
          </div>
        </div>

        {/* Voice Visualizer Orb */}
        <div className="py-8">
          <VoiceOrb volume={volume} isMuted={isMuted} status={status} />
        </div>

        {/* Subtitles / Interviewer Script Card */}
        <div className="glass bg-zinc-950/40 rounded-2xl p-5 border border-zinc-800/40 min-h-[96px] flex items-center justify-center text-center">
          <p className="text-zinc-200 text-base md:text-lg leading-relaxed font-medium transition-all duration-300">
            {status === "idle" ? (
              <span className="text-zinc-500 animate-pulse">Computing session state...</span>
            ) : (
              interviewerText
            )}
          </p>
        </div>

        {/* Chat entry fallback for offline/noisy situations */}
        <form onSubmit={handleSendTypedMessage} className="flex gap-3">
          <input
            type="text"
            value={typedResponse}
            onChange={(e) => setTypedResponse(e.target.value)}
            disabled={status !== "listening"}
            placeholder={
              status === "listening"
                ? "Type your response here if microphone is noisy..."
                : "Waiting for interviewer to finish speaking..."
            }
            className="flex-grow bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={status !== "listening" || !typedResponse.trim()}
            className="p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>

        {/* Bottom controls panel */}
        <div className="flex justify-center items-center gap-6 pt-4 border-t border-zinc-800/80">
          <button
            onClick={toggleMute}
            className={`p-4 rounded-full transition-all border active:scale-95 cursor-pointer ${
              isMuted
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/25"
                : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
            }`}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          <button
            onClick={handleEndInterview}
            className="flex items-center gap-2.5 px-6 py-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm shadow-lg shadow-rose-500/10 border border-rose-500/20 transition-all hover:-translate-y-[1px] active:translate-y-0 cursor-pointer"
          >
            <PhoneOff className="w-5 h-5 fill-current" />
            <span>Finish Session</span>
          </button>
        </div>

      </div>
      
      {/* Audio element for remote WebRTC voice tracks */}
      <audio ref={audioElRef} autoPlay className="hidden" />
    </div>
  );
}
