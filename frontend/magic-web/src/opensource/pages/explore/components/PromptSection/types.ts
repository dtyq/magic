import type { PromptCard, PromptTabs } from "../PromptCard/types"

export interface PromptSection {
	title: string
	desc: string | ""
	cards: PromptCard[]
	type?: "popular" | "latest"
	tabs?: PromptTabs[]
}
