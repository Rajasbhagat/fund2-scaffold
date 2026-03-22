# FUND II AI Agent Platform

A multi-agent AI co-pilot suite designed for IESE MBA students enrolled in Fundamentals of Entrepreneurial Management II (FUND II). The platform gives student teams a single, persistent workspace with four specialized AI agents that guide them through the hackathon course from trend exploration to final pitch.

## 🚀 Features

* **Multi-Agent Co-Pilot Suite**: Four specialized AI agents tailored to different phases of the entrepreneurial journey:
  * **Trend Mapper**: Explore industry trends and market signals.
  * **Value Designer**: Formulate value propositions and business models.
  * **SPI**: Synthetic Persona Interviewer for generating and interviewing customer, investor, and partner personas.
  * **FARO**: Course navigation agent knowledgeable on FUND I, FUND II, and elective syllabi.
* **Persistent Workspaces**: One workspace per student project. Chat histories, agent states, and files are saved persistently.
* **Instant Slide Generation**: Generate structured `.pptx` slides natively from agent conversations (e.g., Target Customer profiles, Trend analyses) once the AI detects enough context.
* **Document Digestion**: Upload PDFs, PPTXs, and DOCXs per project, which are automatically extracted and injected into the active agent's context window.
* **Dynamic Context Window Management**: Token-aware context limits utilizing rolling windows, system prompts, and pre-loaded knowledge bases.
* **Nova-1 HUD Interface**: A sci-fi, telemetry-inspired, grid-based brutalist user interface tailored for immersive system interaction.

## 💻 Tech Stack

* **Framework**: [Next.js](https://nextjs.org/) (App Router)
* **Language**: [TypeScript](https://www.typescriptlang.org/)
* **UI & Styling**: [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)
* **Database**: [SQLite](https://sqlite.org/) 
* **ORM**: [Prisma](https://www.prisma.io/)
* **AI & LLMs**: [Google Vertex AI](https://cloud.google.com/vertex-ai) (Gemini 2.5 Flash) & [Vercel AI SDK](https://sdk.vercel.ai/docs)
* **File Processing**: `pdf-parse`, `mammoth` (DOCX), `pptxgenjs` (PPTX Generation)
* **Deployment**: [Railway](https://railway.app/)

## 🛠️ Getting Started

### Prerequisites

* Node.js 22+
* Google Cloud Platform account with Vertex AI API enabled and Application Default Credentials configured.

### Local Initialization

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Rajasbhagat/fund2-scaffold.git
   cd fund2-scaffold
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` and `.env.local` file based on your GCP configuration.
   ```bash
   DATABASE_URL="file:./dev.db"
   GOOGLE_CLOUD_PROJECT="your-gcp-project-id"
   GOOGLE_CLOUD_LOCATION="us-central1"
   # If running locally, point to your ADC:
   GOOGLE_APPLICATION_CREDENTIALS="/path/to/application_default_credentials.json"
   ```

4. **Initialize the database:**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

5. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the application.

## 📦 Architecture Highlights

* **Single-User MVP**: Designed for a seamless, specialized desktop experience during the MBA timeline. No multi-tenant auth overhead.
* **Full Prompt Injection**: Bypasses typical RAG pipelines in favor of full megatrend/syllabus injection to leverage Gemini 2.5's massive context window accurately.
* **Persistent SQLite**: Designed for fast, local-feeling database interactions with Prisma adapter configured for `better-sqlite3`.

---
*Developed for Fundamentals of Entrepreneurial Management II at IESE Business School.*
