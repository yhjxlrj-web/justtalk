import "server-only";

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

type TranslateParams = {
  originalText: string;
  sourceLanguage: string;
  targetLanguage: string;
};

export type TranslateResult = {
  translatedText: string;
  fallbackUsed: boolean;
};

export async function translateText({
  originalText,
  sourceLanguage,
  targetLanguage
}: TranslateParams): Promise<TranslateResult> {
  const trimmed = originalText.trim();

  console.log("originalText:", originalText);
  console.log("sourceLanguage:", sourceLanguage);
  console.log("targetLanguage:", targetLanguage);

  if (!trimmed) {
    console.log("translate raw model output:", "");
    console.log("translate parsed translatedText:", "");
    console.log("fallbackUsed:", false);
    return { translatedText: "", fallbackUsed: false };
  }

  if (sourceLanguage === targetLanguage) {
    console.log("translate raw model output:", trimmed);
    console.log("translate parsed translatedText:", trimmed);
    console.log("fallbackUsed:", false);
    return { translatedText: trimmed, fallbackUsed: false };
  }

  const prompt = `
You are a strict translator.

Translate the text from ${sourceLanguage} to ${targetLanguage}.

Rules:
- Return only the translated text
- Do not explain anything
- Do not repeat the original text
- Do not add quotation marks
- Even very short greetings must be translated
- Examples:
  - Korean "안녕" -> English "Hello"
  - English "hi" -> Korean "안녕"

Text:
${trimmed}
`;

  try {
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt
    });

    const raw = response.output_text?.trim() ?? "";
    console.log("translate raw model output:", raw);

    if (!raw) {
      console.log("translate parsed translatedText:", trimmed);
      console.log("fallbackUsed:", true);
      return { translatedText: trimmed, fallbackUsed: true };
    }

    if (raw.toLowerCase() === trimmed.toLowerCase()) {
      console.log("first translation matched original, retrying with stronger prompt");

      const retryPrompt = `
Translate this text strictly.

Source language: ${sourceLanguage}
Target language: ${targetLanguage}

You must translate it.
You must not return the source text unchanged.
Return only the translation.

Text:
${trimmed}
`;

      const retryResponse = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: retryPrompt
      });

      const retryRaw = retryResponse.output_text?.trim() ?? "";
      console.log("translate retry raw model output:", retryRaw);

      if (retryRaw && retryRaw.toLowerCase() !== trimmed.toLowerCase()) {
        console.log("translate parsed translatedText:", retryRaw);
        console.log("fallbackUsed:", false);
        return {
          translatedText: retryRaw,
          fallbackUsed: false
        };
      }

      console.log("translate parsed translatedText:", trimmed);
      console.log("fallbackUsed:", true);
      return {
        translatedText: trimmed,
        fallbackUsed: true
      };
    }

    console.log("translate parsed translatedText:", raw);
    console.log("fallbackUsed:", false);
    return {
      translatedText: raw,
      fallbackUsed: false
    };
  } catch (error) {
    console.error("translateText failed:", error);
    console.log("translate parsed translatedText:", trimmed);
    console.log("fallbackUsed:", true);
    return {
      translatedText: trimmed,
      fallbackUsed: true
    };
  }
}