import type { DiscussionFile } from "../types"

/**
 * What a discussion is about: its saved topic, or for older files without one the first
 * question the moderator asked, flagged so the page can label it as such.
 */
export function discussionTitle(
	discussion: Pick<DiscussionFile, "topic" | "rounds">,
): { text: string; isFirstQuestion: boolean } | null {
	const topic = discussion.topic?.trim()
	if (topic) return { text: topic, isFirstQuestion: false }
	const first = discussion.rounds.find((round) => (round.speaker ?? round.role) === "moderator")
	const question = first?.text.replace(/\s+/g, " ").trim()
	return question ? { text: question, isFirstQuestion: true } : null
}
