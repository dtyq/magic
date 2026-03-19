import { shadow } from "@/utils/shadow"

export const CREW_AGENT_PROMPT_VERSION = "1.0.0"

export interface CrewAgentPrompt {
	version: string
	structure?: {
		string?: string
	}
}

export function buildCrewAgentPrompt(text: string): CrewAgentPrompt {
	return {
		version: CREW_AGENT_PROMPT_VERSION,
		structure: {
			string: text,
		},
	}
}

export function resolveCrewAgentPromptText(
	prompt: string | CrewAgentPrompt | null | undefined,
): string {
	if (!prompt) return ""
	if (typeof prompt === "string") return prompt
	return prompt.structure?.string ?? ""
}

export function encodeCrewAgentPrompt(text: string): string {
	return shadow(JSON.stringify(buildCrewAgentPrompt(text)))
}
