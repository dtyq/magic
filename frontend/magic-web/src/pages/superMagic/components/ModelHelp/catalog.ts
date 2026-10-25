import { useTranslation } from "react-i18next"
import { BrainCircuit, Repeat2 } from "lucide-react"
import type { KnownModelErrorCode } from "@/types/chat/conversation_message"

export const MODEL_HELP_ARTICLES = {
	availability: { icon: BrainCircuit },
	switching: { icon: Repeat2 },
} as const

export type ModelHelpArticleId = keyof typeof MODEL_HELP_ARTICLES

const ERROR_ARTICLES = {
	llm_timeout: "availability",
	llm_connection_failed: "availability",
	llm_rate_limited: "availability",
	llm_service_error: "availability",
	llm_config_error: "availability",
	llm_request_rejected: "availability",
} satisfies Record<KnownModelErrorCode, ModelHelpArticleId>

export function getModelHelpArticle(code: string): ModelHelpArticleId {
	return Object.hasOwn(ERROR_ARTICLES, code)
		? ERROR_ARTICLES[code as KnownModelErrorCode]
		: "availability"
}

export function useModelHelpCatalog() {
	const { t } = useTranslation("super")
	return {
		availability: {
			...MODEL_HELP_ARTICLES.availability,
			title: t("modelRecovery.help.availability.title"),
			header: {
				title: t("modelRecovery.help.availability.header"),
				description: t("modelRecovery.help.availability.description"),
			},
			summary: t("modelRecovery.help.availability.summary"),
		},
		switching: {
			...MODEL_HELP_ARTICLES.switching,
			title: t("modelRecovery.help.switching.title"),
			header: {
				title: t("modelRecovery.help.switching.header"),
				description: t("modelRecovery.help.switching.description"),
			},
			summary: t("modelRecovery.help.switching.summary"),
		},
	} satisfies Record<
		ModelHelpArticleId,
		{
			icon: typeof BrainCircuit
			title: string
			header: { title: string; description: string }
			summary: string
		}
	>
}
