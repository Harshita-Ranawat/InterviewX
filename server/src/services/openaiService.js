import OpenAI from "openai";

let client = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

const INTERVIEW_SYSTEM = `You are a professional technical interviewer conducting a spoken mock interview.
Keep replies concise (2-4 sentences) unless the candidate asks for depth.
Ask one clear question at a time. Adapt difficulty to the topic.
Do not invent personal data about the candidate.`;

export async function getInterviewReply({ topic, history }) {
  const openai = getClient();
  const messages = [
    { role: "system", content: `${INTERVIEW_SYSTEM}\nInterview topic/focus: ${topic}` },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
    messages,
    temperature: 0.7,
    max_tokens: 500,
  });
  const text = completion.choices[0]?.message?.content?.trim() || "";
  return text;
}

export async function generateInterviewReport({ topic, transcript }) {
  const openai = getClient();
  const prompt = `You are an interview coach. Given the mock interview topic and full dialogue, produce a structured JSON report ONLY (no markdown fences), with this exact shape:
{
  "summary": "string",
  "strengths": ["string"],
  "improvements": ["string"],
  "sampleBetterAnswers": ["string"],
  "scores": {
    "communication": 0-10 number,
    "technicalDepth": 0-10 number,
    "problemSolving": 0-10 number,
    "structure": 0-10 number
  },
  "overallScore": 0-10 number,
  "recommendations": "string paragraph"
}
Topic: ${topic}
Transcript (chronological):
${transcript}`;

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    max_tokens: 2000,
  });
  let raw = completion.choices[0]?.message?.content?.trim() || "{}";
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {
      summary: raw.slice(0, 2000),
      strengths: [],
      improvements: [],
      sampleBetterAnswers: [],
      scores: {
        communication: 5,
        technicalDepth: 5,
        problemSolving: 5,
        structure: 5,
      },
      overallScore: 5,
      recommendations: "Could not parse structured report; see summary.",
    };
  }
  return { parsed, raw };
}
