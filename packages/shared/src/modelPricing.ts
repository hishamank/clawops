export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-6": { inputPer1M: 15.0, outputPer1M: 75.0 },
  "claude-sonnet-4-6": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-haiku-4-5": { inputPer1M: 0.25, outputPer1M: 1.25 },
  "gpt-4o": { inputPer1M: 5.0, outputPer1M: 15.0 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  llama3: { inputPer1M: 0, outputPer1M: 0 },
  "qwen2.5": { inputPer1M: 0, outputPer1M: 0 },
  "gemini-2.0-flash": { inputPer1M: 0.1, outputPer1M: 0.4 },
};

const OLLAMA_DEFAULT: ModelPricing = { inputPer1M: 0, outputPer1M: 0 };

export function getModelPricing(model: string): ModelPricing {
  const exact = MODEL_PRICING[model];
  if (exact) return exact;

  if (model.startsWith("ollama/")) return OLLAMA_DEFAULT;

  return { inputPer1M: 0, outputPer1M: 0 };
}
