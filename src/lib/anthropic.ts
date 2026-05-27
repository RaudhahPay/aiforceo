import Anthropic from "@anthropic-ai/sdk";

export function getAnthropic(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

export const ANTHROPIC_MODEL: string = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
