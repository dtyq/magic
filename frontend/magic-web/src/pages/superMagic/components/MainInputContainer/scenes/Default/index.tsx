import usePortalTarget from "@/hooks/usePortalTarget"
import {
	SCENE_INPUT_IDS,
	SCENE_ANIMATION_CONFIG,
	hasSlidesTemplateRandomDragType,
} from "../../constants"
import { createPortal } from "react-dom"
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react"
import type { OptionItem, FieldItem } from "../../panels/types"
import { AnimatePresence, motion } from "framer-motion"
import ScenePanelContainer from "../../components/ScenePanelContainer"
import { observer } from "mobx-react-lite"
import DefaultMessageEditorContainer from "../../components/editors/DefaultMessageEditorContainer"
import { ScenePanelComponentBaseProps } from "../../types"
import { useCurrentSceneConfig } from "../../hooks"
import { useIsMobile } from "@/hooks/useIsMobile"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import SlidesTemplateHomeSelectionPreview from "../Slides/SlidesTemplateHomeSelectionPreview"
import { ScenePanelVariant } from "../../components/LazyScenePanel/types"
import { useOptionalScenePanelVariant } from "../../stores"
import VideoProductionConfigPanel from "../../components/VideoProductionConfigPanel"
import { useConversationInputLayout } from "../../../ConversationInputResize/context"
import { cn } from "@/utils/cn"

interface DefaultInputContainerProps extends ScenePanelComponentBaseProps {}

function DefaultInputContainer({
	editorContext,
	editorNodes,
	inputContainerId,
}: DefaultInputContainerProps) {
	const { placeholder, panels, isLoading } = useCurrentSceneConfig({
		topicMode: editorContext?.topicMode,
	})
	const isMobile = useIsMobile()
	const [selectedSlidesTemplate, setSelectedSlidesTemplate] = useState<OptionItem | null>(null)
	const [selectedSlidesFilters, setSelectedSlidesFilters] = useState<FieldItem[]>([])
	const slidesFilterChangeRef = useRef<((filterId: string, value: string) => void) | null>(null)
	const slidesRandomTemplateRequestRef = useRef<(() => void) | null>(null)
	const [slidesTemplatePickerContainer, setSlidesTemplatePickerContainer] =
		useState<HTMLDivElement | null>(null)
	const [isSlidesTemplatePickerOpen, setIsSlidesTemplatePickerOpen] = useState(false)
	const [isSlidesTemplatePreviewOpen, setIsSlidesTemplatePreviewOpen] = useState(false)
	const isSlidesMode = editorContext?.topicMode === TopicMode.PPT
	const selectedTopicId = editorContext?.selectedTopic?.id
	const variant = useOptionalScenePanelVariant()
	const isProjectScene = variant === ScenePanelVariant.TopicPage
	const inputLayout = useConversationInputLayout()
	// A fixed conversation height must propagate through scene wrappers before the editor can scroll.
	const shouldFillHeight = Boolean(inputLayout?.fillHeight)

	useEffect(() => {
		if (!isSlidesMode) {
			setSelectedSlidesTemplate(null)
			setSelectedSlidesFilters([])
			setIsSlidesTemplatePickerOpen(false)
		}
	}, [isSlidesMode])

	useEffect(() => {
		// Local selection outlives topic switches unless we reset it.
		setSelectedSlidesTemplate(null)
		setSelectedSlidesFilters([])
		setIsSlidesTemplatePickerOpen(false)
		setIsSlidesTemplatePreviewOpen(false)
	}, [selectedTopicId])

	const editorPortalTarget = usePortalTarget({
		portalId: inputContainerId ?? SCENE_INPUT_IDS.INPUT_CONTAINER,
		// Desktop home and project composers mount their portal target before this scene (the project
		// page loads it lazily), so resolve it before paint instead of showing an empty composer.
		resolveBeforePaint:
			!isMobile &&
			(variant === ScenePanelVariant.HomePage || variant === ScenePanelVariant.TopicPage),
	})

	const handleTemplateSelect = (template: OptionItem | null) => {
		setIsSlidesTemplatePickerOpen(false)
		if (isSlidesMode) setSelectedSlidesTemplate(template)
		if (!template) return

		console.log("Template selected:", template)
		// 项目页的纵向滚动归 MessageList 管理；选择模板不应改变它的位置。
		// 首页才需要回到工作区顶部，以展示已选择模板的编辑器。
		if (!isProjectScene) {
			requestAnimationFrame(() => {
				const workspaceViewport = document.querySelector<HTMLElement>(
					'[data-testid="main-workspace-container"] [data-slot="scroll-area-viewport"]',
				)
				workspaceViewport?.scrollTo({ top: 0, behavior: "smooth" })
			})
		}

		let attemptCount = 0
		const tryFocus = () => {
			const editor = editorContext?.editorRef?.current?.editor
			if (editor && !editor.isDestroyed) {
				editorContext?.editorRef?.current?.focus?.({
					enableWhenIsMobile: false,
					preventScroll: true,
				})
				return
			}
			attemptCount++
			if (attemptCount >= 20) return
			window.setTimeout(tryFocus, 100)
		}
		window.setTimeout(tryFocus, 300)
	}

	const handleFilterChange = (filters: FieldItem[]) => {
		if (isSlidesMode) setSelectedSlidesFilters(filters)
	}

	const handleSlidesFilterChange = (filterId: string, value: string) => {
		slidesFilterChangeRef.current?.(filterId, value)
	}

	const handleRandomTemplateRequest = () => {
		slidesRandomTemplateRequestRef.current?.()
	}

	const handleEditorRandomDragOver = (event: DragEvent<HTMLDivElement>) => {
		if (!hasSlidesTemplateRandomDragType(event.dataTransfer)) return
		event.preventDefault()
		event.stopPropagation()
		event.dataTransfer.dropEffect = "none"
	}

	const handleEditorRandomDrop = (event: DragEvent<HTMLDivElement>) => {
		if (!hasSlidesTemplateRandomDragType(event.dataTransfer)) return
		event.preventDefault()
		event.stopPropagation()
	}

	const handleSlidesTemplatePickerContainerChange = useCallback(
		(container: HTMLDivElement | null) => {
			setSlidesTemplatePickerContainer(container)
		},
		[],
	)

	const editorNode =
		editorPortalTarget &&
		editorContext &&
		createPortal(
			<AnimatePresence mode="wait">
				<motion.div
					key="slides-editor"
					className={cn(shouldFillHeight && "h-full min-h-0")}
					initial={SCENE_ANIMATION_CONFIG.initial}
					animate={SCENE_ANIMATION_CONFIG.animate}
					exit={SCENE_ANIMATION_CONFIG.exit}
					transition={SCENE_ANIMATION_CONFIG.transition}
				>
					<div
						className={cn("flex flex-col gap-2", shouldFillHeight && "h-full min-h-0")}
					>
						<div
							className={cn(shouldFillHeight && "min-h-0 flex-1 [&>div]:h-full")}
							onDragEnterCapture={handleEditorRandomDragOver}
							onDragOverCapture={handleEditorRandomDragOver}
							onDropCapture={handleEditorRandomDrop}
						>
							<DefaultMessageEditorContainer
								editorContext={{
									...editorContext,
									placeholder,
								}}
								editorNodes={editorNodes}
							/>
						</div>
						<VideoProductionConfigPanel
							topicMode={editorContext.topicMode}
							agentCode={editorContext.agentCode}
							selectedTopic={editorContext.selectedTopic}
						/>
						{isSlidesMode ? (
							<SlidesTemplateHomeSelectionPreview
								template={selectedSlidesTemplate}
								filters={selectedSlidesFilters}
								onRandomTemplateRequest={handleRandomTemplateRequest}
								onClear={
									selectedSlidesTemplate
										? () => setSelectedSlidesTemplate(null)
										: undefined
								}
								onFilterChange={handleSlidesFilterChange}
								onTemplatePickerContainerChange={
									isProjectScene
										? handleSlidesTemplatePickerContainerChange
										: undefined
								}
								className={cn(
									isProjectScene && "gap-2 p-2",
									shouldFillHeight && "shrink-0",
								)}
								templatePickerOpen={isSlidesTemplatePickerOpen}
								onTemplatePickerOpenChange={setIsSlidesTemplatePickerOpen}
								showTemplateActions={isProjectScene}
								isTemplatePreviewOpen={isSlidesTemplatePreviewOpen}
								compactLayout={isProjectScene}
							/>
						) : null}
					</div>
				</motion.div>
			</AnimatePresence>,
			editorPortalTarget,
		)

	return (
		<>
			{!isMobile && editorNode}
			<ScenePanelContainer
				panels={panels}
				loading={isLoading}
				selectedTemplate={isSlidesMode ? selectedSlidesTemplate : undefined}
				onSlidesFilterChangeRequestChange={(handler) => {
					slidesFilterChangeRef.current = handler
				}}
				onSlidesRandomTemplateRequestChange={(handler) => {
					slidesRandomTemplateRequestRef.current = handler
				}}
				onSlidesTemplatePreviewOpenChange={setIsSlidesTemplatePreviewOpen}
				slidesTemplatePickerContainer={slidesTemplatePickerContainer}
				onTemplateSelect={handleTemplateSelect}
				onFilterChange={handleFilterChange}
			/>
			{isMobile && editorNode}
		</>
	)
}

export default observer(DefaultInputContainer)
