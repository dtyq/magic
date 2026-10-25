import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { AnimatePresence } from "framer-motion"
import { cn } from "@/utils/cn"
import MagicSpin from "@/components/base/MagicSpin"
import { Flex } from "antd"
import { ScheduledTaskApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { projectStore } from "@/pages/superMagic/stores/core"
import { isReadOnlyProject } from "@/pages/superMagic/utils/permission"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { shouldWaitForShareAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import AICardConfigPanel from "./components/AICardConfigPanel"
import AICardDashboard from "./components/AICardDashboard"
import AICardDetail from "./components/AICardDetail"
import { AICardStore } from "./stores/AICardStore"
import type { AICardHistoryEntry, AICardRootRenderProps } from "./types"
import {
	extractChatTopicIdFromExecuteResult,
	switchToTopicByChatTopicId,
} from "./utils/aiCardRunNow"

interface AICardAttachmentNode {
	file_id?: string
	children?: AICardAttachmentNode[]
}

function findNodeWithChildrenByFileId(
	items: AICardAttachmentNode[] | undefined,
	fileId?: string,
): AICardAttachmentNode | null {
	if (!items?.length || !fileId) return null

	for (const item of items) {
		if (item?.file_id === fileId && Array.isArray(item.children) && item.children.length > 0) {
			return item
		}
		const matched = findNodeWithChildrenByFileId(item?.children, fileId)
		if (matched) return matched
	}

	return null
}

function resolveAICardAttachmentSource({
	data,
	attachments,
	attachmentList,
}: Pick<AICardRootRenderProps, "data" | "attachments" | "attachmentList">):
	AICardRootRenderProps["attachments"] | undefined {
	const folderFileId = data?.file_id
	const attachmentTree = attachments as AICardAttachmentNode[] | undefined
	const flatAttachments = attachmentList as AICardAttachmentNode[] | undefined
	const matchedAttachmentFolder = findNodeWithChildrenByFileId(attachmentTree, folderFileId)
	if (matchedAttachmentFolder) return [matchedAttachmentFolder]
	if (Array.isArray(data?.children) && data.children.length > 0) return [data]
	const matchedFlatFolder = findNodeWithChildrenByFileId(flatAttachments, folderFileId)
	if (matchedFlatFolder) return [matchedFlatFolder]
	return attachmentList || attachments
}

/**
 * AICardRootRender
 *
 * Entry component for AI Card display. Manages a local AICardStore that
 * parses the card directory structure (magic.project.js)
 * and renders either a dashboard grid, a card detail view, or history view.
 *
 * Animations are powered by framer-motion with layoutId transitions
 * between dashboard tiles and the detail view.
 */
function AICardRootRender(props: AICardRootRenderProps) {
	const fileAccess = useFileAccess()
	if (shouldWaitForShareAccess(fileAccess)) {
		return (
			<Flex className="h-full w-full items-center justify-center">
				<MagicSpin />
			</Flex>
		)
	}
	return <AICardRootRenderReady {...props} />
}

const AICardRootRenderReady = observer(function AICardRootRenderReady(
	props: AICardRootRenderProps,
) {
	const { data, attachments, attachmentList, className } = props
	const { t } = useTranslation("super")

	const folderFileId = data?.file_id
	const initialNavigation = data?.initialNavigation

	const stableAttachmentList = useMemo(
		() => resolveAICardAttachmentSource({ data, attachments, attachmentList }),
		[data, attachments, attachmentList],
	)

	// Create store instance per mount
	const fileApi = useFileApi()
	// Inject the access-bound file client at this React boundary: AI Card previews are
	// mounted on share pages where the unbound leaves fail closed for magic.project.js.
	const store = useMemo(() => new AICardStore(fileApi), [fileApi])
	const [isRunNowLoading, setIsRunNowLoading] = useState(false)
	const selectedProject =
		props.selectedProject ??
		(props.projectId ? { id: props.projectId } : projectStore.selectedProject)

	// Permission check: only users with edit access can configure / run
	const canEdit = !isReadOnlyProject(projectStore.selectedProject?.user_role)

	// Track whether initialNavigation has been applied
	const appliedNavigationRef = useRef(false)

	// Sync store with attachment data
	useEffect(() => {
		store.sync(folderFileId, stableAttachmentList)
	}, [store, folderFileId, stableAttachmentList])

	// Apply initialNavigation or auto-show config after loading completes
	useEffect(() => {
		if (store.loading || appliedNavigationRef.current) return
		appliedNavigationRef.current = true

		// If no config exists, force config panel (only for editors)
		if (!store.hasConfig && canEdit) {
			store.setViewMode("config")
			return
		}

		if (initialNavigation?.activeCardId) {
			store.openCardDetail(initialNavigation.activeCardId)
		}
	}, [store, store.loading, initialNavigation, canEdit, folderFileId])

	const handleOpenConfig = useCallback(() => {
		store.setViewMode("config")
	}, [store])

	const handleOpenCard = useCallback(
		(cardId: string) => {
			store.openCardDetail(cardId)
		},
		[store],
	)

	const handleBack = useCallback(() => {
		store.goBack()
	}, [store])

	const handleRunNow = useCallback(async () => {
		const scheduleId = store.projectConfig?.schedule_id
		if (!scheduleId || isRunNowLoading) return

		setIsRunNowLoading(true)
		try {
			const response = await ScheduledTaskApi.executeScheduledTask(scheduleId)
			if (!response?.success) {
				magicToast.error(response?.error_message || t("detail.aiCard.runNow.error"))
				return
			}

			const chatTopicId = extractChatTopicIdFromExecuteResult(response)
			if (chatTopicId) {
				const switched = await switchToTopicByChatTopicId(chatTopicId)
				if (switched) {
					magicToast.success(t("detail.aiCard.runNow.successSwitched"))
					return
				}
			}

			magicToast.success(t("detail.aiCard.runNow.success"))
		} catch {
			magicToast.error(t("detail.aiCard.runNow.error"))
		} finally {
			setIsRunNowLoading(false)
		}
	}, [store, isRunNowLoading, t])

	const handleOpenHistoryEntry = useCallback(
		(entry: AICardHistoryEntry) => {
			store.openHistoryDetail(entry.fileId)
		},
		[store],
	)

	const handleOpenPreviousVersion = useCallback(() => {
		store.openPreviousDetailVersion()
	}, [store])

	const handleOpenNextVersion = useCallback(() => {
		store.openNextDetailVersion()
	}, [store])

	if (store.loading) {
		return (
			<Flex
				justify="center"
				align="center"
				className={cn("h-full w-full bg-background", className)}
			>
				<MagicSpin spinning />
			</Flex>
		)
	}

	return (
		<div
			className={cn("h-full w-full overflow-hidden bg-background", className)}
			data-testid="ai-card-root"
		>
			<AnimatePresence mode="wait">
				{store.viewMode === "config" && canEdit && (
					<AICardConfigPanel
						key="config"
						store={store}
						onBack={store.hasConfig ? handleBack : undefined}
					/>
				)}
				{store.viewMode === "dashboard" && (
					<AICardDashboard
						key="dashboard"
						cards={store.cards}
						historyEntries={store.historyEntries}
						projectConfig={store.projectConfig}
						attachmentList={stableAttachmentList}
						selectedProject={selectedProject}
						onOpenCard={handleOpenCard}
						onOpenConfig={canEdit ? handleOpenConfig : undefined}
						onRunNow={
							canEdit && store.projectConfig?.schedule_id ? handleRunNow : undefined
						}
						isRunNowLoading={isRunNowLoading}
						onOpenHistoryEntry={handleOpenHistoryEntry}
					/>
				)}
				{store.viewMode === "detail" && store.activeCard && (
					<AICardDetail
						key="detail"
						card={store.activeCard}
						htmlFileId={store.detailFileId}
						attachmentList={stableAttachmentList}
						canGoToPreviousVersion={store.canOpenPreviousDetailVersion}
						canGoToNextVersion={store.canOpenNextDetailVersion}
						onOpenPreviousVersion={
							store.detailVersionCount > 1 ? handleOpenPreviousVersion : undefined
						}
						onOpenNextVersion={
							store.detailVersionCount > 1 ? handleOpenNextVersion : undefined
						}
						selectedProject={selectedProject}
						onBack={handleBack}
					/>
				)}
			</AnimatePresence>
		</div>
	)
})

export default AICardRootRender
