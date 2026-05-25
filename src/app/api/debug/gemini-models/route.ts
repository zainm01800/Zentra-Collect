/**
 * GET /api/debug/gemini-models
 * Temporary debug route — lists available Gemini models for the configured API key.
 * Remove after diagnosis is complete.
 */
import { NextResponse } from "next/server";

export async function GET() {
  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!geminiKey) {
    return NextResponse.json({
      error: "No key found",
      checked: ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
    });
  }

  const keyHint = `${geminiKey.slice(0, 8)}...${geminiKey.slice(-4)}`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}&pageSize=50`,
    );
    const data = await resp.json();

    if (!resp.ok) {
      return NextResponse.json({ keyHint, status: resp.status, error: data });
    }

    const models = (data.models ?? []).map((m: { name: string; supportedGenerationMethods?: string[] }) => ({
      name: m.name,
      canGenerate: m.supportedGenerationMethods?.includes("generateContent"),
    }));

    return NextResponse.json({ keyHint, modelCount: models.length, models });
  } catch (err) {
    return NextResponse.json({ keyHint, error: String(err) });
  }
}
