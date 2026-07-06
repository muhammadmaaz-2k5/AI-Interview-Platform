# 🤖 AI Interview Platform

An advanced, real-time AI-powered technical and communication interview platform. The system ingests candidate resumes, conducts interactive voice-and-video interviews using dynamic AI avatars, evaluates responses in real-time, and generates multi-dimensional performance reports.

---

## 🏗️ System Architecture

The following diagram illustrates the high-level system architecture, from client interaction to backend services and the real-time AI pipeline.

```mermaid
graph TB
    %% Styling definitions
    classDef client fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#01579b;
    classDef gateway fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px,color:#1b5e20;
    classDef core fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#e65100;
    classDef ai fill:#ede7f6,stroke:#4a148c,stroke-width:2px,color:#4a148c;
    classDef storage fill:#eceff1,stroke:#37474f,stroke-width:2px,color:#37474f;

    subgraph ClientLayer ["Client Layer (WebRTC enabled)"]
        A["Candidate UI (Browser)"]:::client
        B["Interviewer Dashboard"]:::client
    end

    subgraph GatewayLayer ["Gateway & Orchestration"]
        API["API Gateway / Load Balancer"]:::gateway
        Orch["Interview Session Orchestrator"]:::gateway
    end

    subgraph CoreServices ["Core Services"]
        Parser["Resume Parser Service"]:::core
        Auth["Auth & User Service"]:::core
        ReportGen["Report Evaluation Engine"]:::core
    end

    subgraph AIPipeline ["AI Pipeline (Real-Time Async)"]
        STT["Speech-to-Text (STT)"]:::ai
        LLM["AI Interviewer (LLM/SLM)"]:::ai
        TTS["Text-to-Speech (TTS)"]:::ai
        Avatar["Avatar/Video Generator"]:::ai
    end

    subgraph StorageLayer ["Storage & Database"]
        DB[("Application DB <br/> (Profiles, Transcripts)")]:::storage
        S3["Object Storage <br/> (Resumes, Video Recordings)"]:::storage
    end

    %% Client connections
    A -->|Upload Resume / WebRTC Stream| API
    B -->|View Reports / Manage| API

    %% Gateway to services
    API --> Orch
    API --> Parser
    API --> Auth

    %% Services interactions
    Parser -->|Extract Profiles| DB
    Parser -->|Store PDFs| S3
    
    %% Orchestration to AI Pipeline
    Orch -->|WebRTC Audio/Video| STT
    STT -->|Transcribed Text| LLM
    LLM -->|Evaluate & Gen Follow-up| TTS
    TTS -->|Synthesis Audio| Avatar
    Avatar -->|Real-Time Avatar Stream| Orch
    Orch -->|Stream to Candidate| A

    %% Session saving
    Orch -->|Save Transcript & Record| DB
    Orch -->|Save Video Files| S3

    %% Report Generation
    ReportGen -->|Process Transcripts| DB
    ReportGen -->|Output Evaluation| B
```

---

## 🔄 Interactive Interview Flow

The interview process operates in a closed-loop system powered by WebRTC for low latency communication. The candidate interacts directly with a speaking AI avatar that dynamically changes its questions based on candidate answers and profile context.

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate
    participant FE as Candidate UI (WebRTC)
    participant Orch as Session Orchestrator
    participant Parser as Resume Parser
    participant AI as AI Engine (LLM)
    participant STT as STT Service
    participant TTS as TTS Service
    participant Av as Avatar Generator

    %% Step 1: Profile creation
    Candidate->>FE: Upload Resume (PDF)
    FE->>Orch: Post Resume Document
    Orch->>Parser: Parse Resume
    Parser-->>Orch: Candidate Profile JSON
    Orch-->>FE: Profile Created & Confirmed

    %% Step 2: Interview Loop
    Note over Candidate, FE: Interview Session Starts
    Orch->>AI: Generate Initial Question (based on Profile)
    AI-->>Orch: Text Question
    Orch->>TTS: Synthesize Question
    TTS-->>Orch: Audio Stream
    Orch->>Av: Generate Avatar Animation
    Av-->>Orch: Video/Audio Stream
    Orch->>FE: Stream Question (WebRTC Video+Audio)
    FE->>Candidate: Plays Avatar Video & Audio Question

    rect rgb(240, 248, 255)
        Note right of Candidate: Answer Phase (Loop)
        Candidate->>FE: Speaks Answer (Video + Audio)
        FE->>Orch: Real-Time WebRTC Media Stream
        Orch->>STT: Transcribe Audio
        STT-->>Orch: Transcribed Text Answer
        Orch->>AI: Send Answer Text
        AI->>AI: Evaluate Answer & Generate Follow-up
        AI-->>Orch: Next Question Text
        Orch->>TTS: Synthesize Next Question
        TTS-->>Orch: Audio Stream
        Orch->>Av: Generate Avatar Animation
        Av-->>Orch: Video/Audio Stream
        Orch->>FE: Stream Next Question (WebRTC)
        FE->>Candidate: Plays next question
    end

    %% Step 3: Reporting
    Note over Candidate, FE: Interview Session Ends
    Orch->>AI: Generate Final Evaluation
    AI->>AI: Calculate Scores & Analyze Weaknesses/Strengths
    AI-->>Orch: Final Report (Scores, Match, Feedback)
    Orch-->>FE: Display Final Report
```

---

## 🧩 Component Breakdown

### 1. Resume Parser & Profiler
- **Ingestion**: Accepts PDF format resumes from the Candidate UI.
- **Parsing Engine**: Extracts skills, experience timeline, education, and domain expertise.
- **Output**: Generates a standardized Candidate Profile schema stored in the Database to prime the AI Interviewer.

### 2. Live WebRTC Orchestration
- **Low-Latency Streaming**: Manages real-time audio and video ingestion from the candidate's camera and microphone.
- **Signaling**: Connects and manages WebRTC peers.
- **Broadcasting**: Streams generated AI avatar responses back to the candidate's browser with minimal delay.

### 3. Real-Time AI Pipeline
- **Speech-To-Text (STT)**: Transcribes incoming audio streams to text in real-time.
- **Language Models (LLM/SLM)**: 
  - Evaluates the answers based on technical correctness and depth.
  - Dynamically synthesizes custom follow-up questions tailored to the candidate's response.
- **Text-To-Speech (TTS)**: Translates LLM generated follow-up text questions back to lifelike voice audio.
- **Avatar/Video Generator**: Drives a photorealistic digital avatar with lip-synchronization aligned with the synthetic voice audio.

### 4. Evaluation & Reporting
At the end of the session, the platform aggregates all data points to compile a **Final Candidate Report** containing:
- **Technical Score**: Assessment of programming, architectural, and domain knowledge.
- **Communication Score**: Evaluation of clarity, structure, and speaking pace.
- **Confidence Level**: Behavioral indicators analyzed during the interview.
- **Resume Match**: Similarity index between candidate answers/claims and the parsed resume data.
- **Detailed Feedback**: Categorized breakdown of the candidate's **Strengths** and **Weaknesses**.