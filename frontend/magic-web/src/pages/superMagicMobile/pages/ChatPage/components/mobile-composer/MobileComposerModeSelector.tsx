import { useEffect, useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"
import {
	Check,
	ChevronLeft,
	ChevronsUpDown,
	ImageIcon,
	MessageSquareText,
	Search,
	Video,
	X,
} from "lucide-react"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { cn } from "@/lib/utils"
import { DataEmptyState } from "@/pages/superMagicMobile/components/DataEmptyState"
import { Trans, useTranslation } from "react-i18next"
import { useFeaturedModeListRefreshOnFirstOpen } from "@/pages/superMagic/hooks/useFeaturedModeListRefresh"
import ModeAvatar from "@/pages/superMagic/components/ModeAvatar"
import ModelIcon from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/components/ModelIcon"
import { ModelListContent } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/components/ModelListContent"
import { ModelTabSwitcher } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/components/ModelTabSwitcher"
import useTopicModel from "@/pages/superMagic/components/MessageEditor/hooks/useTopicModel"
import { useOptionalMessageEditorStore } from "@/pages/superMagic/components/MessageEditor/stores"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/types"
import type {
	ModelListKey,
	ModelListGroup,
	ModelTabType,
} from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import { Button } from "@/components/shadcn-ui/button"
import type { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import type { CrewItem, ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

interface MobileComposerModeSelectorProps {
	className?: string
	iconSize?: number
	selectedTopic?: Topic | null
	selectedProject?: ProjectListItem | null
	topicMode?: TopicMode
	agentCode?: string | null
	selectorVariant?: "default" | "claw"
	topicModelStore?: ReturnType<typeof createSuperMagicTopicModelStore>
	messagesLength?: number
	/** When true, confirm popup copy uses chat (对话) instead of topic (话题). */
	useChatTerminology?: boolean
	onModeChange?: (mode: TopicMode) => void
}

interface ModelRowData {
	triggerTestId: string
	label: string
	icon: React.ReactNode
	defaultTab: "language" | "image" | "video"
	model: ModelItem | null
}

function modeMatchesTopic(
	modeIdentifier: string,
	topicMode: TopicMode | undefined,
	agentCode?: string | null,
) {
	if (topicMode === "custom_agent" && agentCode) return modeIdentifier === agentCode
	return modeIdentifier === topicMode
}

function getFirstAvailableModel(
	modelGroups: ModelListGroup[],
	modelKey: ModelListKey,
): ModelItem | null {
	for (const group of modelGroups) {
		const models =
			modelKey === "image_models"
				? (group.image_models ?? [])
				: modelKey === "video_models"
					? (group.video_models ?? [])
					: (group.models ?? [])
		if (models.length > 0) return models[0]
	}

	return null
}

function MobileComposerModeSelectorComponent({
	className,
	iconSize = 16,
	selectedTopic,
	selectedProject,
	topicMode,
	agentCode,
	selectorVariant = "default",
	topicModelStore,
	messagesLength,
	useChatTerminology,
	onModeChange,
}: MobileComposerModeSelectorProps) {
	const { t: tMainInput } = useTranslation("super/mainInput")
	const { t: tSuper } = useTranslation("super")
	const store = useOptionalMessageEditorStore()
	const modeList = superMagicModeService.modeList
	const {
		modelList,
		imageModelList,
		videoModelList,
		topicModelStore: resolvedTopicModelStore,
		validateSelectedModels,
		setSelectedModel,
		setSelectedImageModel,
		setSelectedVideoModel,
	} = useTopicModel({
		selectedTopic,
		selectedProject,
		agentCode,
		topicMode,
		topicModelStore: topicModelStore ?? store?.topicModelStore,
	})
	const [open, setOpen] = useState(false)
	const [showNewTopicModal, setShowNewTopicModal] = useState<{
		visible: boolean
		mode: CrewItem["mode"] | null
	}>({
		visible: false,
		mode: null,
	})
	const [activeModelRow, setActiveModelRow] = useState<ModelRowData | null>(null)
	const [activeModelTab, setActiveModelTab] = useState<ModelTabType>("language")
	const [modelSearchKeyword, setModelSearchKeyword] = useState("")
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const selectedModeItemRef = useRef<HTMLButtonElement>(null)
	const modelScrollContainerRef = useRef<HTMLDivElement>(null)
	const selectedModelItemRef = useRef<HTMLDivElement>(null)
	const isClawVariant = selectorVariant === "claw"

	useFeaturedModeListRefreshOnFirstOpen(open)

	const currentMode = useMemo(() => {
		if (!topicMode) return null
		return superMagicModeService.getModeConfigWithLegacy(topicMode, undefined, false, agentCode)
	}, [agentCode, topicMode])
	const allowChangeMode = (messagesLength ?? 0) > 0 ? false : true

	useEffect(() => {
		if (!open || activeModelRow || isClawVariant) return

		const timer = window.setTimeout(() => {
			const container = scrollContainerRef.current
			const selectedItem = selectedModeItemRef.current
			if (!container || !selectedItem) return

			const containerRect = container.getBoundingClientRect()
			const itemRect = selectedItem.getBoundingClientRect()
			const targetScrollTop =
				container.scrollTop +
				(itemRect.top - containerRect.top) -
				(containerRect.height - itemRect.height) / 2

			container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: "smooth" })
		}, 200)

		return () => {
			window.clearTimeout(timer)
		}
	}, [activeModelRow, isClawVariant, open])

	useEffect(() => {
		if (!activeModelRow) return

		const timer = window.setTimeout(() => {
			const container = modelScrollContainerRef.current
			const selectedItem = selectedModelItemRef.current
			if (!container || !selectedItem) return

			const containerRect = container.getBoundingClientRect()
			const itemRect = selectedItem.getBoundingClientRect()
			const targetScrollTop =
				container.scrollTop +
				(itemRect.top - containerRect.top) -
				(containerRect.height - itemRect.height) / 2

			container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: "smooth" })
		}, 100)

		return () => {
			window.clearTimeout(timer)
		}
	}, [activeModelRow, activeModelTab])

	useEffect(() => {
		if (open) return

		setActiveModelRow(null)
		setActiveModelTab("language")
		setModelSearchKeyword("")
	}, [open])

	const resolveModeText = useMemoizedFn((text?: string, fallback?: string) => {
		if (!text) return fallback || ""
		const translated = tSuper(text)
		return translated === text ? text : translated
	})

	const closeAllPanels = useMemoizedFn(() => {
		setOpen(false)
		setShowNewTopicModal({ visible: false, mode: null })
		setActiveModelRow(null)
		setActiveModelTab("language")
		setModelSearchKeyword("")
	})

	const handleCreateNewTopic = useMemoizedFn(() => {
		const targetMode = showNewTopicModal.mode?.identifier as TopicMode | undefined
		if (!targetMode) return

		closeAllPanels()

		setTimeout(() => {
			document.body.style.removeProperty("pointer-events")
			// 携带目标专家模式，对话页（单话题 Chat）会用它创建新对话而非兄弟话题
			pubsub.publish(PubSubEvents.Create_New_Topic, { topicMode: targetMode })
			onModeChange?.(targetMode)
		}, 0)
	})

	const handleSelectCrew = useMemoizedFn((crew: CrewItem) => {
		if (allowChangeMode) {
			onModeChange?.(crew.mode.identifier as TopicMode)
			closeAllPanels()
			return
		}

		if (modeMatchesTopic(crew.mode.identifier, topicMode, agentCode)) {
			closeAllPanels()
			return
		}

		if (selectedTopic) {
			const isSameTarget =
				showNewTopicModal.visible &&
				showNewTopicModal.mode?.identifier === crew.mode.identifier

			setShowNewTopicModal(
				isSameTarget ? { visible: false, mode: null } : { visible: true, mode: crew.mode },
			)
			return
		}

		onModeChange?.(crew.mode.identifier as TopicMode)
		closeAllPanels()
	})

	const handleBackToModeList = useMemoizedFn(() => {
		setActiveModelRow(null)
		setModelSearchKeyword("")
	})

	const triggerModelSwitch = useMemoizedFn(async (row: ModelRowData) => {
		setShowNewTopicModal({ visible: false, mode: null })

		try {
			await validateSelectedModels()
		} finally {
			setActiveModelTab(row.defaultTab)
			setModelSearchKeyword("")
			setActiveModelRow(row)
		}
	})

	const handleModelSelect = useMemoizedFn((model: ModelItem) => {
		if (activeModelTab === "image") {
			setSelectedImageModel(model)
		} else if (activeModelTab === "video") {
			setSelectedVideoModel(model)
		} else {
			setSelectedModel(model)
		}

		setActiveModelRow(null)
		setModelSearchKeyword("")
	})

	const getModelDescription = useMemoizedFn((model: ModelItem) => {
		return model.model_description
	})

	const hasImageModels =
		imageModelList.length > 0 &&
		imageModelList.some((item) => (item.image_models ?? []).length > 0)
	const hasVideoModels =
		videoModelList.length > 0 &&
		videoModelList.some((item) => (item.video_models ?? []).length > 0)

	const modelRows: ModelRowData[] = [
		{
			triggerTestId: "mobile-composer-language-model-trigger",
			label: tSuper("messageEditor.modelSwitch.languageModel"),
			icon: <MessageSquareText size={20} className="shrink-0" />,
			defaultTab: "language",
			model: resolvedTopicModelStore.selectedLanguageModel,
		},
		...(hasImageModels
			? [
					{
						triggerTestId: "mobile-composer-image-model-trigger",
						label: tSuper("messageEditor.modelSwitch.imageModel"),
						icon: <ImageIcon size={20} className="shrink-0" />,
						defaultTab: "image" as const,
						model: resolvedTopicModelStore.selectedImageModel,
					},
				]
			: []),
		...(hasVideoModels
			? [
					{
						triggerTestId: "mobile-composer-video-model-trigger",
						label: tSuper("messageEditor.modelSwitch.videoModel"),
						icon: <Video size={20} className="shrink-0" />,
						defaultTab: "video" as const,
						model: resolvedTopicModelStore.selectedVideoModel,
					},
				]
			: []),
	]

	const showImageTab = hasImageModels
	const showVideoTab = hasVideoModels
	const currentModelList =
		activeModelTab === "image"
			? imageModelList
			: activeModelTab === "video"
				? videoModelList
				: modelList
	const currentSelectedModel =
		activeModelTab === "image"
			? resolvedTopicModelStore.selectedImageModel
			: activeModelTab === "video"
				? resolvedTopicModelStore.selectedVideoModel
				: resolvedTopicModelStore.selectedLanguageModel
	const currentModelKey: ModelListKey =
		activeModelTab === "image"
			? "image_models"
			: activeModelTab === "video"
				? "video_models"
				: "models"
	const isCurrentTabEmpty =
		(activeModelTab === "image" && !hasImageModels) ||
		(activeModelTab === "video" && !hasVideoModels)

	const clawStackModels = useMemo(() => {
		const candidates = [
			resolvedTopicModelStore.selectedLanguageModel ??
				getFirstAvailableModel(modelList, "models"),
			resolvedTopicModelStore.selectedImageModel ??
				getFirstAvailableModel(imageModelList, "image_models"),
			resolvedTopicModelStore.selectedVideoModel ??
				getFirstAvailableModel(videoModelList, "video_models"),
		].filter(Boolean) as ModelItem[]
		const visitedModelIds = new Set<string>()

		return candidates.filter((model) => {
			if (visitedModelIds.has(model.model_id)) return false
			visitedModelIds.add(model.model_id)
			return true
		})
	}, [
		imageModelList,
		modelList,
		resolvedTopicModelStore.selectedImageModel,
		resolvedTopicModelStore.selectedLanguageModel,
		resolvedTopicModelStore.selectedVideoModel,
		videoModelList,
	])

	return (
		<>
			<button
				type="button"
				className={cn(
					"flex shrink-0 items-center rounded-full bg-transparent",
					isClawVariant ? "h-7 min-h-7 gap-1.5 px-1.5 py-0" : "h-8 min-h-8 gap-1 px-2",
					className,
				)}
				onClick={() => setOpen(true)}
				aria-label={
					isClawVariant
						? tSuper("messageEditor.modelSwitch.headerTitle")
						: tMainInput("crewSelectModal.title")
				}
				data-testid={
					isClawVariant
						? "mobile-composer-claw-model-selector-trigger"
						: "mobile-composer-mode-selector-trigger"
				}
			>
				{isClawVariant ? (
					<div
						className="flex h-7 shrink-0 items-center gap-1"
						data-testid="mobile-composer-claw-model-selector-stack"
					>
						{clawStackModels.length === 1 ? (
							<>
								<div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-card shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
									<ModelIcon
										model={clawStackModels[0]}
										size={26}
										className="shrink-0 rounded-full"
									/>
								</div>
								<span className="text-md max-w-[80px] truncate text-foreground">
									{clawStackModels[0].model_name}
								</span>
							</>
						) : clawStackModels.length > 1 ? (
							<div
								className="relative h-7 shrink-0"
								style={{ width: (clawStackModels.length - 1) * 18 + 26 }}
							>
								{clawStackModels.slice(0, 3).map((model, index) => (
									<div
										key={model.model_id}
										className="absolute top-1/2 flex h-[26px] w-[26px] -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-card"
										style={{
											left: index * 18,
											zIndex: clawStackModels.length - index,
											boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
										}}
									>
										<ModelIcon
											model={model}
											size={26}
											className="shrink-0 rounded-full"
										/>
									</div>
								))}
							</div>
						) : (
							<div
								className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2 border-background bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
								data-testid="mobile-composer-claw-model-selector-fallback"
							>
								<MessageSquareText size={14} className="shrink-0" />
							</div>
						)}
					</div>
				) : currentMode ? (
					<ModeAvatar
						mode={currentMode.mode}
						iconSize={iconSize}
						data-testid="mobile-composer-mode-selector-avatar"
					/>
				) : null}
				<ChevronsUpDown
					size={isClawVariant ? 12 : 16}
					className="shrink-0 text-foreground"
				/>
			</button>

			<MagicPopup
				visible={open}
				onClose={closeAllPanels}
				className="rounded-t-[14px] border-0 bg-muted"
				bodyClassName="overflow-hidden rounded-t-[14px] border-0 bg-muted p-0"
				handlerClassName="bg-muted-foreground mb-1.5 h-1 w-20 rounded-full"
			>
				{activeModelRow ? (
					<div
						className="flex h-[min(640px,calc(100dvh-var(--safe-area-inset-top)-var(--safe-area-inset-bottom)-44px))] min-h-0 w-full flex-col overflow-hidden bg-muted"
						data-testid="mobile-composer-mode-selector-model-popup"
					>
						<div className="mobile-popup-action-header relative flex h-14 w-full shrink-0 items-center justify-center px-16 py-2">
							<button
								type="button"
								onClick={handleBackToModeList}
								className="absolute left-[10px] top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
								aria-label={tSuper("common.back", { defaultValue: "Back" })}
								data-testid="mobile-composer-mode-selector-model-back-button"
							>
								<ChevronLeft className="size-[22px] text-foreground" />
							</button>
							<p className="max-w-[247px] truncate text-center text-[18px] font-medium leading-6 text-foreground">
								{tSuper("messageEditor.modelSwitch.headerTitle")}
							</p>
						</div>

						<div className="shrink-0 pt-2.5">
							<ModelTabSwitcher
								activeTab={activeModelTab}
								onTabChange={setActiveModelTab}
								showImageTab={showImageTab}
								showVideoTab={showVideoTab}
								isMobile
							/>
						</div>

						<div
							ref={modelScrollContainerRef}
							className="scrollbar-y-thin flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto rounded-lg p-3"
							data-testid="mobile-composer-mode-selector-model-list"
						>
							{isCurrentTabEmpty ? (
								<DataEmptyState
									variant="model"
									compact
									className="min-h-0 py-8"
									testId="mobile-composer-mode-selector-model-empty"
								/>
							) : (
								<ModelListContent
									modelList={currentModelList}
									selectedModel={currentSelectedModel || null}
									searchKeyword={modelSearchKeyword}
									size="mobile"
									onModelClick={handleModelSelect}
									selectedItemRef={selectedModelItemRef}
									getModelDescription={getModelDescription}
									modelKey={currentModelKey}
									onModelsLoaded={validateSelectedModels}
								/>
							)}
						</div>

						<div className="shrink-0 px-2.5 pb-[max(var(--safe-area-inset-bottom),10px)] pt-2">
							<div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 shadow-xs">
								<Search className="h-4 w-4 shrink-0 text-muted-foreground" />
								<input
									type="search"
									value={modelSearchKeyword}
									onChange={(event) => setModelSearchKeyword(event.target.value)}
									placeholder={tSuper(
										"messageEditor.modelSwitch.searchPlaceholder",
									)}
									className="min-h-0 flex-1 border-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
									autoComplete="off"
									autoCorrect="off"
									autoCapitalize="off"
									spellCheck={false}
									enterKeyHint="search"
									data-testid="mobile-composer-mode-selector-model-search-input"
								/>
								{modelSearchKeyword ? (
									<button
										type="button"
										onClick={() => setModelSearchKeyword("")}
										className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted-foreground text-background transition active:opacity-80"
										aria-label={tSuper("common.cancel")}
										data-testid="mobile-composer-mode-selector-model-search-clear-button"
									>
										<X className="h-3 w-3" />
									</button>
								) : null}
							</div>
						</div>
					</div>
				) : (
					<div
						className="flex flex-col overflow-hidden bg-muted"
						data-testid={
							isClawVariant
								? "mobile-composer-claw-model-selector-popup"
								: "mobile-composer-mode-selector-popup"
						}
					>
						<div className="mobile-popup-action-header relative flex h-14 items-center justify-center">
							<button
								type="button"
								onClick={closeAllPanels}
								className="absolute left-[10px] top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-card"
								style={{ boxShadow: "0px 8px 25px 0px rgba(0,0,0,0.10)" }}
								aria-label={tMainInput("chatSettings.close")}
								data-testid={
									isClawVariant
										? "mobile-composer-claw-model-selector-close-button"
										: "mobile-composer-mode-selector-close-button"
								}
							>
								<X className="h-[22px] w-[22px] text-foreground" />
							</button>
							<div className="max-w-[247px] truncate text-center text-lg font-semibold leading-none text-foreground">
								{isClawVariant
									? tSuper("messageEditor.modelSwitch.headerTitle")
									: tMainInput("chatSettings.title")}
							</div>
						</div>

						{!isClawVariant ? (
							<>
								<div
									ref={scrollContainerRef}
									className="no-scrollbar max-h-[300px] min-h-0 flex-1 overflow-y-auto px-3.5 py-2.5"
									data-testid="mobile-composer-mode-selector-list"
								>
									{modeList.length === 0 ? (
										<DataEmptyState
											variant="crew"
											compact
											className="h-full py-8"
										/>
									) : (
										<div className="flex flex-col gap-1.5">
											{modeList.map((crew) => {
												const isActive = modeMatchesTopic(
													crew.mode.identifier,
													topicMode,
													agentCode,
												)
												return (
													<button
														key={crew.mode.identifier}
														type="button"
														ref={isActive ? selectedModeItemRef : null}
														onClick={() => handleSelectCrew(crew)}
														className={cn(
															"flex h-12 w-full items-center gap-3 rounded-full transition-colors active:opacity-60",
															isActive && "bg-card",
														)}
														style={{
															paddingLeft: 7,
															paddingRight: 16,
															...(isActive
																? {
																		boxShadow:
																			"0px 1px 3px 0px rgba(0,0,0,0.10), 0px 1px 2px 0px rgba(0,0,0,0.10)",
																	}
																: {}),
														}}
														data-testid="mobile-composer-mode-selector-item"
													>
														<ModeAvatar
															mode={crew.mode}
															iconSize={34}
															data-testid={`mobile-composer-mode-selector-avatar-${crew.mode.identifier}`}
														/>
														<span className="flex-1 truncate text-left text-base font-medium leading-5 text-foreground">
															{crew.mode.name}
														</span>
														{isActive ? (
															<Check
																className="h-4 w-4 shrink-0 text-foreground"
																strokeWidth={2}
															/>
														) : null}
													</button>
												)
											})}
										</div>
									)}
								</div>

								<div className="shrink-0 px-3.5">
									<div className="h-px w-full bg-border" />
								</div>
							</>
						) : null}

						<div
							className={cn(
								"mx-auto flex w-full shrink-0 flex-col gap-0 px-3.5",
								isClawVariant
									? "pb-[max(var(--safe-area-inset-bottom),10px)] pt-2"
									: "pb-2.5",
							)}
							data-testid={
								isClawVariant
									? "mobile-composer-claw-model-selector-model-section"
									: "mobile-composer-mode-selector-model-section"
							}
						>
							{modelRows.map((row) => (
								<div
									key={row.triggerTestId}
									className="relative"
									data-testid={`${row.triggerTestId}-row`}
								>
									<button
										type="button"
										onClick={() => void triggerModelSwitch(row)}
										className="flex h-12 w-full items-center gap-2.5 overflow-hidden transition-opacity active:opacity-60"
										data-testid={`${row.triggerTestId}-button`}
									>
										<div className="flex min-w-0 flex-1 items-center gap-2">
											<div className="flex h-5 w-5 shrink-0 items-center justify-center text-foreground">
												{row.icon}
											</div>
											<span className="whitespace-nowrap text-base leading-none text-foreground">
												{row.label}
											</span>
										</div>
										<div className="flex min-w-0 max-w-[56%] shrink items-center justify-end gap-1">
											{row.model ? (
												<ModelIcon
													model={row.model}
													size={16}
													className="shrink-0 rounded-full"
												/>
											) : null}
											<span className="min-w-0 truncate text-right text-base text-foreground">
												{row.model?.model_name ??
													tSuper("messageEditor.modelSwitch.selectModel")}
											</span>
											<ChevronsUpDown className="h-4 w-4 shrink-0 text-foreground" />
										</div>
									</button>
								</div>
							))}
						</div>
					</div>
				)}
			</MagicPopup>

			<MagicPopup
				visible={showNewTopicModal.visible}
				onClose={() => setShowNewTopicModal({ visible: false, mode: null })}
				className="rounded-t-[14px] border-0 bg-muted"
				bodyClassName="rounded-t-[14px] border-0 bg-muted p-0 overflow-hidden"
				handlerClassName="bg-muted-foreground mb-1.5 h-1 w-20 rounded-full"
			>
				<div
					className="flex flex-col gap-4 p-4"
					data-testid="mobile-composer-mode-selector-create-topic-dialog"
				>
					<div className="text-sm leading-6 text-foreground">
						{useChatTerminology ? (
							<Trans
								i18nKey="modeToggle.cannotSwitchModeMessageChat"
								ns="super"
								values={{
									modeName: resolveModeText(showNewTopicModal.mode?.name),
								}}
								components={{
									strong: <strong />,
								}}
							/>
						) : (
							<Trans
								i18nKey="modeToggle.cannotSwitchModeMessage"
								ns="super"
								values={{
									modeName: resolveModeText(showNewTopicModal.mode?.name),
								}}
								components={{
									strong: <strong />,
								}}
							/>
						)}
					</div>
					<Button
						type="button"
						onClick={handleCreateNewTopic}
						className="h-10 w-full"
						data-testid="mobile-composer-mode-selector-create-topic-button"
					>
						{useChatTerminology
							? tSuper("modeToggle.createNewChat")
							: tSuper("modeToggle.createNewTopic")}
					</Button>
				</div>
			</MagicPopup>
		</>
	)
}

const MobileComposerModeSelector = observer(MobileComposerModeSelectorComponent)

export default MobileComposerModeSelector
