import { useCallback, useMemo } from "react"
import { observer } from "mobx-react-lite"
import { superMagicStore } from "@/pages/superMagic/stores"
import { MessageViewStateScopeProvider } from "@/pages/superMagic/components/MessageList/view-state/MessageViewStateContext"
import { handleToolCallInteraction } from "./interactions"
import { getToolCardInteractionTarget } from "../../toolDetailSelection"
import { useToolRemarkPreview } from "./preview/useToolRemarkPreview"
import { ToolCallRenderer } from "./ToolCallRenderer"
import { useMessageListProjectFilesStore } from "@/pages/superMagic/components/MessageList/context"
import { getPendingCanvasOperationResultDetail } from "@/pages/superMagic/utils/toolDetailDisplay"
import {
	isToolCallLoading,
	type ToolCallContainerProps,
	type ToolCallViewModel,
	type ToolDetail,
} from "./types"

export const ToolCallContainer = observer(function ToolCallContainer(
	props: ToolCallContainerProps,
) {
	const {
		topicId,
		correlationId,
		ownerSuperMessageId,
		toolCall,
		classNames,
		onMouseEnter,
		onMouseLeave,
		onSelectDetail,
		selectedTopic,
		isShare,
	} = props
	const filesStore = useMessageListProjectFilesStore()
	const toolResponse = ownerSuperMessageId
		? (superMagicStore.getToolResponseForRendering?.(topicId, ownerSuperMessageId, toolCall) ??
			superMagicStore.toolResponseMap.get(topicId)?.get(toolCall.id))
		: superMagicStore.toolResponseMap.get(topicId)?.get(toolCall.id)
	const effectiveResponse = toolResponse || toolCall.tool
	const effectiveDetail = useMemo(
		() =>
			isRecord(effectiveResponse?.detail)
				? (effectiveResponse.detail as ToolDetail)
				: undefined,
		[effectiveResponse],
	)
	const effectiveStatus = useMemo(() => resolveToolStatus(effectiveResponse), [effectiveResponse])
	// Store normalization owns protocol status; nested detail.status is domain data.
	const isToolLoading = isToolCallLoading({ tool: effectiveResponse })
	const responseRemark =
		typeof effectiveResponse?.remark === "string"
			? effectiveResponse.remark
			: toolCall.tool?.remark
	const streamToolCall = ownerSuperMessageId
		? superMagicStore
				.getStreamState(topicId, ownerSuperMessageId)
				?.tool_calls.find((candidate) => candidate?.id === toolCall.id)
		: undefined
	// The visual typewriter intentionally trails StreamState. Remark parsers consume the
	// canonical accumulated arguments so short metadata such as file paths is not blocked
	// behind reasoning, content, or large tool payload projection.
	const previewArguments =
		typeof streamToolCall?.function?.arguments === "string"
			? streamToolCall.function.arguments
			: toolCall.function.arguments || ""
	const pendingDetail = useMemo(
		() =>
			isToolLoading && !effectiveDetail
				? getPendingCanvasOperationResultDetail(toolCall.function.name, previewArguments)
				: undefined,
		[effectiveDetail, isToolLoading, previewArguments, toolCall.function.name],
	)
	const renderDetail = effectiveDetail || pendingDetail
	const previewRemark = useToolRemarkPreview({
		enabled: !responseRemark,
		identity: `${topicId}:${ownerSuperMessageId || correlationId}:${toolCall.id}`,
		toolName: toolCall.function.name,
		rawArguments: previewArguments,
	})

	const toolData = useMemo<ToolCallViewModel>(() => {
		const action =
			typeof effectiveResponse?.action === "string"
				? effectiveResponse.action
				: toolCall.function.label
		const attachments = Array.isArray(effectiveResponse?.attachments)
			? (effectiveResponse.attachments as ToolCallViewModel["attachments"])
			: []

		return {
			id: toolCall.id,
			downloadProgress: toolResponse?.downloadProgress,
			name:
				typeof effectiveResponse?.name === "string" &&
				[
					"download_from_urls",
					"audio_understanding",
					"audio_understanding_progress",
					"video_generation_progress",
				].includes(effectiveResponse.name)
					? effectiveResponse.name
					: toolCall.function.name,
			action,
			// Preview strategies only fill an empty UI remark; canonical response remains authoritative.
			remark: responseRemark || previewRemark,
			status: effectiveStatus,
			attachments,
			interactionTarget: getToolCardInteractionTarget(toolCall.function.name, renderDetail),
			rawArguments: previewArguments,
			detail: renderDetail,
		}
	}, [
		toolCall.id,
		toolCall.function.name,
		toolCall.function.label,
		responseRemark,
		previewRemark,
		effectiveResponse,
		toolResponse?.downloadProgress,
		effectiveStatus,
		previewArguments,
		renderDetail,
	])

	const onClick = useCallback(() => {
		handleToolCallInteraction({ toolData, onSelectDetail, filesStore })
	}, [filesStore, onSelectDetail, toolData])

	return (
		<MessageViewStateScopeProvider messageKey={toolCall.id}>
			<ToolCallRenderer
				{...props}
				toolData={toolData}
				loading={isToolLoading}
				onClick={onClick}
				classNames={classNames}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
				onSelectDetail={onSelectDetail}
				selectedTopic={selectedTopic}
				isShare={isShare}
			/>
		</MessageViewStateScopeProvider>
	)
})

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value)
}

function resolveToolStatus(response: unknown) {
	const responseRecord = isRecord(response) ? response : undefined
	return getStringValue(responseRecord, "status")
}

function getStringValue(record: Record<string, unknown> | undefined, key: string) {
	const value = record?.[key]
	return typeof value === "string" ? value : undefined
}

export default ToolCallContainer
