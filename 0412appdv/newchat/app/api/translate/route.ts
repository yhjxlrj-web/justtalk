import { NextResponse } from "next/server";
import { translateText } from "@/lib/openai/translate";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    text?: string;
    sourceLanguage?: string;
    targetLanguage?: string;
  };

  if (!payload.text || !payload.targetLanguage) {
    return NextResponse.json(
      { error: "Both text and targetLanguage are required." },
      { status: 400 }
    );
  }

  const translation = await translateText({
    originalText: payload.text,
    sourceLanguage: payload.sourceLanguage ?? "auto",
    targetLanguage: payload.targetLanguage
  });

  return NextResponse.json(translation);
}
