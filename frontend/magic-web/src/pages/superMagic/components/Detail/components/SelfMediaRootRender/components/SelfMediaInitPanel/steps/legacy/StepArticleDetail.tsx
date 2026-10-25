import { useState, useCallback, useRef, useMemo, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import type {
	ArticleDetail,
	SelfMediaInitGlobalSettings,
	OutlineNode,
	MaterialItem,
} from "../../types"
import { STYLE_PRESETS, ALL_PLATFORMS, getVisualPresetsForPlatform } from "../../types"
import type { SelfMediaPlatform } from "../../../../../../types"
import ArticleOutlineEditor from "../../components/article/ArticleOutlineEditor"
import AiInputBox from "../../components/ai/AiInputBox"
import ModelSelector from "../../components/picker/ModelSelector"
import ReferenceSection from "../../components/material/ReferenceSection"
import ReferenceFilePicker from "../../components/picker/ReferenceFilePicker"
import VisualPresetPicker from "../../components/picker/VisualPresetPicker"
import InlineVoiceButton from "../../components/ui/InlineVoiceButton"
import { generateOutline, optimizeOutline } from "../../../../services/selfMediaAiGenerate"

interface StepArticleDetailProps {
	articles: ArticleDetail[]
	globalSettings: SelfMediaInitGlobalSettings
	onArticleUpdate: (index: number, article: ArticleDetail) => void
	onPersistDraft?: () => void
}

export default function StepArticleDetail({
	articles,
	globalSettings,
	onArticleUpdate,
	onPersistDraft,
}: StepArticleDetailProps) {
	const [activeTab, setActiveTab] = useState(0)
	const [generatingOutline, setGeneratingOutline] = useState(false)
	const [configExpanded, setConfigExpanded] = useState(false)
	const [outlineModel, setOutlineModel] = useState("")
	const [sharedModel, setSharedModel] = useState("")
	const [optimizePopoverOpen, setOptimizePopoverOpen] = useState(false)
	const [optimizeInstruction, setOptimizeInstruction] = useState("")
	const abortRef = useRef<AbortController | null>(null)
	const outlineActionRef = useRef<HTMLDivElement>(null)
	const { t } = useTranslation("super")

	const currentArticle = articles[activeTab]
	const hasOutline = (currentArticle?.outline.length ?? 0) > 0

	useEffect(() => {
		setOptimizePopoverOpen(false)
		setOptimizeInstruction("")
	}, [activeTab])

	useEffect(() => {
		if (!optimizePopoverOpen) return
		const handler = (e: MouseEvent) => {
			if (outlineActionRef.current && !outlineActionRef.current.contains(e.target as Node)) {
				setOptimizePopoverOpen(false)
			}
		}
		document.addEventListener("mousedown", handler)
		return () => document.removeEventListener("mousedown", handler)
	}, [optimizePopoverOpen])

	// Auto-expand config section if article already has style/outline configured
	const hasConfig =
		currentArticle?.style !== "professional" ||
		(currentArticle?.outline.length ?? 0) > 0 ||
		(currentArticle?.visualPreset && currentArticle.visualPreset !== "none")
	const showConfig = configExpanded || hasConfig

	const effectivePlatform = currentArticle?.platform || "rednote"
	const availableVisualPresets = useMemo(
		() => getVisualPresetsForPlatform(effectivePlatform as SelfMediaPlatform),
		[effectivePlatform],
	)

	const handleFieldChange = useCallback(
		(field: keyof ArticleDetail, value: any) => {
			if (!currentArticle) return
			onArticleUpdate(activeTab, { ...currentArticle, [field]: value })
		},
		[activeTab, currentArticle, onArticleUpdate],
	)

	const handleOutlineChange = useCallback(
		(outline: OutlineNode[]) => {
			if (!currentArticle) return
			onArticleUpdate(activeTab, { ...currentArticle, outline })
		},
		[activeTab, currentArticle, onArticleUpdate],
	)

	const handleMaterialsChange = useCallback(
		(materials: MaterialItem[]) => {
			if (!currentArticle) return
			onArticleUpdate(activeTab, { ...currentArticle, materials })
		},
		[activeTab, currentArticle, onArticleUpdate],
	)

	const handleAiOutline = useCallback(async () => {
		if (generatingOutline || !currentArticle) return
		setGeneratingOutline(true)

		const controller = new AbortController()
		abortRef.current = controller

		try {
			const outline = await generateOutline({
				global: globalSettings,
				article: currentArticle,
				model: outlineModel || undefined,
				signal: controller.signal,
			})
			if (outline.length > 0) {
				onArticleUpdate(activeTab, { ...currentArticle, outline })
			}
		} catch (err) {
			if ((err as Error).name !== "AbortError") {
				console.error("Failed to generate outline:", err)
			}
		} finally {
			setGeneratingOutline(false)
			abortRef.current = null
		}
	}, [
		generatingOutline,
		globalSettings,
		currentArticle,
		activeTab,
		onArticleUpdate,
		outlineModel,
	])

	const handleAiOptimize = useCallback(
		async (instruction: string) => {
			if (generatingOutline || !currentArticle) return
			setGeneratingOutline(true)
			setOptimizePopoverOpen(false)

			const controller = new AbortController()
			abortRef.current = controller

			try {
				const outline = await optimizeOutline({
					global: globalSettings,
					article: currentArticle,
					instruction,
					model: outlineModel || undefined,
					signal: controller.signal,
				})
				if (outline.length > 0) {
					onArticleUpdate(activeTab, { ...currentArticle, outline })
				}
			} catch (err) {
				if ((err as Error).name !== "AbortError") {
					console.error("Failed to optimize outline:", err)
				}
			} finally {
				setGeneratingOutline(false)
				abortRef.current = null
			}
		},
		[
			generatingOutline,
			globalSettings,
			currentArticle,
			activeTab,
			onArticleUpdate,
			outlineModel,
		],
	)

	const handleOutlineButtonClick = useCallback(() => {
		if (generatingOutline) {
			abortRef.current?.abort()
			return
		}
		if (hasOutline) {
			setOptimizePopoverOpen((open) => !open)
			return
		}
		handleAiOutline()
	}, [generatingOutline, hasOutline, handleAiOutline])

	if (!currentArticle) return null

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-6 text-center">
				<h2 className="mb-2 text-xl font-bold tracking-tight">
					{t("detail.selfMedia.initPanel.stepDetail.title")}
				</h2>
				<p className="text-sm text-muted-foreground">
					{t("detail.selfMedia.initPanel.stepDetail.subtitle")}
				</p>
			</div>

			{/* Tab bar */}
			{articles.length > 1 && (
				<div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-muted/50 p-1.5">
					{articles.map((article, index) => (
						<button
							key={index}
							type="button"
							className={cn(
								"shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200",
								index === activeTab
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground",
							)}
							onClick={() => {
								if (index !== activeTab) onPersistDraft?.()
								setActiveTab(index)
							}}
							data-testid="on-persist-draft"
						>
							{article.title ||
								t("detail.selfMedia.initPanel.stepDetail.articleFallback", {
									index: index + 1,
								})}
						</button>
					))}
				</div>
			)}

			{/* Article detail form */}
			<div className="flex flex-col gap-6">
				{/* Title preview */}
				<div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
					<span className="text-xs text-muted-foreground">
						{t("detail.selfMedia.initPanel.stepDetail.currentArticle")}
					</span>
					<h3 className="mt-0.5 text-sm font-semibold">
						{currentArticle.title ||
							t("detail.selfMedia.initPanel.stepDetail.untitled")}
					</h3>
				</div>

				{/* Platform selection (required) */}
				<div>
					<label className="mb-2 block text-sm font-semibold" data-testid="step-article-detail-label">
						{t("detail.selfMedia.initPanel.stepDetail.platformLabel")}
					</label>
					<div className="flex flex-wrap gap-2">
						{ALL_PLATFORMS.filter((p) => !p.disabled).map((p) => (
							<button
								key={p.value}
								type="button"
								className={cn(
									"rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
									currentArticle.platform === p.value
										? "border-primary bg-primary/10 text-primary"
										: "border-border/60 text-muted-foreground hover:border-primary/40",
								)}
								onClick={() =>
									handleFieldChange("platform", p.value as SelfMediaPlatform)
								}
								data-testid="handle-field-change"
							>
								{t(p.labelKey)}
							</button>
						))}
					</div>
					{!currentArticle.platform && (
						<p className="mt-1.5 text-xs text-destructive">
							{t("detail.selfMedia.initPanel.stepDetail.platformRequired")}
						</p>
					)}
				</div>

				{/* AI description input */}
				<AiInputBox
					label={t("detail.selfMedia.initPanel.stepDetail.descriptionLabel")}
					value={currentArticle.description ?? ""}
					onChange={(v) => handleFieldChange("description", v)}
					onBlur={onPersistDraft}
					polishContext={`Article title: ${currentArticle.title}, Platform: ${currentArticle.platform || ""}`}
					placeholder={t("detail.selfMedia.initPanel.stepDetail.descriptionPlaceholder")}
					model={sharedModel}
					onModelChange={setSharedModel}
				/>

				{/* Collapsible config toggle */}
				{!showConfig && (
					<button
						type="button"
						className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 py-3 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground"
						onClick={() => setConfigExpanded(true)}
						data-testid="set-config-expanded"
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							data-testid="step-article-detail-svg"
						>
							<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
							<circle cx="12" cy="12" r="3" />
						</svg>
						{t("detail.selfMedia.initPanel.stepDetail.expandConfig")}
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							data-testid="step-article-detail-svg-2"
						>
							<polyline points="6 9 12 15 18 9" />
						</svg>
					</button>
				)}

				{/* Content style */}
				{showConfig && (
					<>
						<div>
							<label className="mb-2.5 block text-sm font-semibold" data-testid="step-article-detail-label-2">
								{t("detail.selfMedia.initPanel.stepDetail.styleLabel")}
							</label>
							<div className="flex flex-wrap gap-2">
								{STYLE_PRESETS.map((preset) => (
									<button
										key={preset.value}
										type="button"
										className={cn(
											"rounded-lg border px-3.5 py-2 text-xs font-medium transition-all duration-200",
											currentArticle.style === preset.value
												? "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/10"
												: "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
										)}
										onClick={() => handleFieldChange("style", preset.value)}
										data-testid="handle-field-change-2"
									>
										{t(preset.labelKey)}
									</button>
								))}
							</div>
							{currentArticle.style === "custom" && (
								<div className="group relative mt-3">
									<input
										type="text"
										className="w-full rounded-lg border border-input bg-background px-4 py-2.5 pr-7 text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
										placeholder={t(
											"detail.selfMedia.initPanel.stepDetail.stylePlaceholder",
										)}
										value={
											typeof currentArticle.style === "string" &&
											currentArticle.style !== "custom"
												? currentArticle.style
												: ""
										}
										onChange={(e) =>
											handleFieldChange("style", e.target.value || "custom")
										}
										data-testid="handle-field-change-3"
									/>
									<InlineVoiceButton
										value={
											typeof currentArticle.style === "string" &&
											currentArticle.style !== "custom"
												? currentArticle.style
												: ""
										}
										onResult={(text) => {
											handleFieldChange("style", text || "custom")
										}}
									/>
								</div>
							)}
						</div>

						{/* Visual preset */}
						<div>
							<label className="mb-2.5 block text-sm font-semibold" data-testid="step-article-detail-label-3">
								{t("detail.selfMedia.initPanel.stepDetail.visualLabel")}
							</label>
							<p className="mb-2 text-xs text-muted-foreground">
								{t("detail.selfMedia.initPanel.stepDetail.visualHint")}
							</p>
							<VisualPresetPicker
								presets={availableVisualPresets}
								value={currentArticle.visualPreset || "none"}
								onChange={(v) => handleFieldChange("visualPreset", v)}
								size="md"
								customDescription={
									currentArticle.notes.includes("[视觉描述]")
										? currentArticle.notes
												.split("[视觉描述]")[1]
												?.split("[/视觉描述]")[0] || ""
										: ""
								}
								onCustomDescriptionChange={(desc) => {
									const base = currentArticle.notes
										.replace(/\[视觉描述\].*?\[\/视觉描述\]/g, "")
										.trim()
									const newNotes = desc
										? `${base}\n[视觉描述]${desc}[/视觉描述]`.trim()
										: base
									handleFieldChange("notes", newNotes)
								}}
								customDescriptionJson={currentArticle.visualDescriptionJson}
								onCustomDescriptionJsonChange={(json) =>
									handleFieldChange("visualDescriptionJson", json)
								}
								visualReferenceFiles={currentArticle.visualReferenceFiles || []}
								onVisualReferenceFilesChange={(files) =>
									handleFieldChange("visualReferenceFiles", files)
								}
							/>
						</div>

						{/* Outline */}
						<div>
							<div className="mb-2.5 flex items-center justify-between">
								<label className="text-sm font-semibold" data-testid="step-article-detail-label-4">
									{t("detail.selfMedia.initPanel.stepDetail.outlineLabel")}
								</label>
								<div className="flex items-center gap-2">
									<ModelSelector
										value={outlineModel}
										onChange={setOutlineModel}
									/>
									<div ref={outlineActionRef} className="relative">
										<button
											type="button"
											className={cn(
												"flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200",
												generatingOutline
													? "border-primary/30 bg-primary/5 text-primary"
													: "border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 active:scale-[0.97]",
											)}
											onClick={handleOutlineButtonClick}
											disabled={!currentArticle.title.trim()}
											data-testid="handle-outline-button-click"
										>
											{generatingOutline ? (
												<>
													<svg
														className="animate-spin"
														width="12"
														height="12"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														strokeWidth="2"
														data-testid="step-article-detail-svg-3"
													>
														<path d="M21 12a9 9 0 1 1-6.219-8.56" />
													</svg>
													{t(
														hasOutline
															? "detail.selfMedia.initPanel.stepDetail.outlineOptimizing"
															: "detail.selfMedia.initPanel.stepDetail.outlineGenerating",
													)}
												</>
											) : (
												<>
													<svg
														width="12"
														height="12"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														strokeWidth="2"
														strokeLinecap="round"
														strokeLinejoin="round"
														data-testid="step-article-detail-svg-4"
													>
														<path d="M12 2v4M16.2 7.8l2.9-2.9M18 12h4M16.2 16.2l2.9 2.9M12 18v4M4.9 19.1l2.9-2.9M2 12h4M4.9 4.9l2.9 2.9" />
													</svg>
													{t(
														hasOutline
															? "detail.selfMedia.initPanel.stepDetail.outlineOptimizeBtn"
															: "detail.selfMedia.initPanel.stepDetail.outlineGenerateBtn",
													)}
												</>
											)}
										</button>

										{optimizePopoverOpen &&
											hasOutline &&
											!generatingOutline && (
												<div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-popover p-3 shadow-lg animate-in fade-in-0 zoom-in-95">
													<div className="group relative">
														<textarea
															className="min-h-[96px] w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 pr-7 text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
															placeholder={t(
																"detail.selfMedia.initPanel.stepDetail.outlineOptimizePlaceholder",
															)}
															rows={4}
															value={optimizeInstruction}
															onChange={(e) =>
																setOptimizeInstruction(
																	e.target.value,
																)
															}
															autoFocus
															data-testid="set-optimize-instruction"
														/>
														<InlineVoiceButton
															variant="textarea"
															value={optimizeInstruction}
															onResult={setOptimizeInstruction}
														/>
													</div>
													<div className="mt-2 flex justify-end">
														<button
															type="button"
															className={cn(
																"inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.97]",
																!optimizeInstruction.trim() &&
																	"opacity-50 cursor-not-allowed",
															)}
															disabled={!optimizeInstruction.trim()}
															onClick={() =>
																handleAiOptimize(
																	optimizeInstruction,
																)
															}
															data-testid="handle-ai-optimize"
														>
															<svg
																width="12"
																height="12"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																strokeWidth="2"
																strokeLinecap="round"
																strokeLinejoin="round"
																data-testid="step-article-detail-svg-5"
															>
																<path d="M12 2v4M16.2 7.8l2.9-2.9M18 12h4M16.2 16.2l2.9 2.9M12 18v4M4.9 19.1l2.9-2.9M2 12h4M4.9 4.9l2.9 2.9" />
															</svg>
															{t(
																"detail.selfMedia.initPanel.stepDetail.outlineOptimizeSubmit",
															)}
														</button>
													</div>
												</div>
											)}
									</div>
								</div>
							</div>
							<ArticleOutlineEditor
								outline={currentArticle.outline}
								onChange={handleOutlineChange}
								onBlur={onPersistDraft}
							/>
						</div>

						{/* Card count */}
						{currentArticle.platform !== "wechat-official-accounts" && (
							<div>
								<label className="mb-2 block text-sm font-semibold" data-testid="step-article-detail-label-5">
									{t("detail.selfMedia.initPanel.stepDetail.cardCountLabel")}
								</label>
								<div className="flex items-center gap-3">
									<input
										type="number"
										min={1}
										max={20}
										className="w-20 rounded-lg border border-input bg-background px-3 py-2 text-sm text-center focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
										value={currentArticle.cardCount}
										onChange={(e) =>
											handleFieldChange(
												"cardCount",
												Math.max(1, parseInt(e.target.value) || 1),
											)
										}
										data-testid="handle-field-change-4"
									/>
									<span className="text-xs text-muted-foreground">
										{t("detail.selfMedia.initPanel.stepDetail.cardCountHint")}
									</span>
								</div>
							</div>
						)}
					</>
				)}

				{/* References: optional text + attachments */}
				<ReferenceSection
					text={currentArticle.notes}
					onTextChange={(v) => handleFieldChange("notes", v)}
					materials={currentArticle.materials}
					onMaterialsChange={handleMaterialsChange}
					onBlur={onPersistDraft}
				/>
			</div>
		</div>
	)
}
