import modelCache from "@/services/superMagic/topicModel/SuperMagicTopicModelCacheService"
import { when } from "mobx"
import type { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import type { ModelItem } from "../types"

type TopicModelStore = ReturnType<typeof createSuperMagicTopicModelStore>

export const MESSAGE_SEND_MODEL_WAIT_TIMEOUT_MS = 15_000

export class MessageSendModelWaitError extends Error {
	constructor(public readonly reason: "timeout" | "aborted" | "failed") {
		super(`Message send model wait ${reason}`)
		this.name = "MessageSendModelWaitError"
	}
}

interface ResolveMessageSendModelsParams {
	topicModelStore: TopicModelStore
	selectedModel?: ModelItem | null
	selectedImageModel?: ModelItem | null
	selectedVideoModel?: ModelItem | null
	waitTimeoutMs?: number
	signal?: AbortSignal
}

export interface ResolvedMessageSendModels {
	selectedModel: ModelItem
	selectedImageModel: ModelItem | null
	selectedVideoModel: ModelItem | null
}

export async function resolveMessageSendModels({
	topicModelStore,
	selectedModel,
	selectedImageModel,
	selectedVideoModel,
	waitTimeoutMs = MESSAGE_SEND_MODEL_WAIT_TIMEOUT_MS,
	signal,
}: ResolveMessageSendModelsParams): Promise<ResolvedMessageSendModels | null> {
	if (topicModelStore.isLoading) {
		try {
			await when(() => !topicModelStore.isLoading, {
				timeout: waitTimeoutMs,
				signal,
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : ""
			if (message === "WHEN_ABORTED") {
				throw new MessageSendModelWaitError("aborted")
			}
			if (message === "WHEN_TIMEOUT") {
				throw new MessageSendModelWaitError("timeout")
			}
			throw new MessageSendModelWaitError("failed")
		}
	}

	if (!topicModelStore.isLanguageModelReady) return null

	const languageModel = selectedModel ?? topicModelStore.selectedLanguageModel
	if (!languageModel?.model_id) return null

	return {
		selectedModel: modelCache.snapshotLanguageModel(languageModel),
		selectedImageModel: selectedImageModel ?? topicModelStore.selectedImageModel,
		selectedVideoModel: selectedVideoModel ?? topicModelStore.selectedVideoModel,
	}
}
