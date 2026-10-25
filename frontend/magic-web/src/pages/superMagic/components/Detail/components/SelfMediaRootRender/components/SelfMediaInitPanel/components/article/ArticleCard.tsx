import { useState, useCallback, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import type {
	ArticleDetail,
	SelfMediaInitGlobalSettings,
	OutlineNode,
	ReferenceFileValue,
	MaterialItem,
} from "../../types"
import type { SelfMediaFileStorageService } from "../../../../services/SelfMediaFileStorageService"
import {
	generateOutline,
	generateCardContent,
	optimizeOutline,
	optimizeCardContent,
} from "../../../../services/selfMediaAiGenerate"
import { Trash2, ChevronDown, Folder } from "lucide-react"
import ArticleCardWorkspace from "./ArticleCardWorkspace"

interface ArticleCardProps {
	index: number
	article: ArticleDetail
	globalSettings: SelfMediaInitGlobalSettings
	onUpdate: (article: ArticleDetail) => void
	onRemove: () => void
	onPersistDraft?: () => void
	fileStorageService?: SelfMediaFileStorageService | null
	alwaysExpanded?: boolean
	hideHeader?: boolean
	showFolderField?: boolean
}

export default function ArticleCard({
	index,
	article,
	globalSettings,
	onUpdate,
	onRemove,
	onPersistDraft,
	fileStorageService,
	alwaysExpanded = false,
	hideHeader = false,
	showFolderField = true,
}: ArticleCardProps) {
	const { t } = useTranslation("super")
	const [expanded, setExpanded] = useState(false)
	const [generatingOutline, setGeneratingOutline] = useState(false)
	const [outlineModel, setOutlineModel] = useState("")
	const [optimizePopoverOpen, setOptimizePopoverOpen] = useState(false)
	const [optimizeInstruction, setOptimizeInstruction] = useState("")
	const abortRef = useRef<AbortController | null>(null)
	const outlineActionRef = useRef<HTMLDivElement>(null)
	const articleRef = useRef(article)
	articleRef.current = article

	const hasOutline = (article.outline.length ?? 0) > 0

	const hasConfig =
		article.style !== "professional" ||
		hasOutline ||
		(article.visualPreset && article.visualPreset !== "none")

	useEffect(() => {
		if (hasConfig && !expanded) setExpanded(true)
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

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

	const effectivePlatform = article.platform || "rednote"
	const isCardPlatform = effectivePlatform === "rednote" || effectivePlatform === "instagram"

	const handleFieldChange = useCallback(
		<K extends keyof ArticleDetail>(field: K, value: ArticleDetail[K]) => {
			onUpdate({ ...article, [field]: value })
		},
		[article, onUpdate],
	)

	const handleOutlineChange = useCallback(
		(outline: OutlineNode[]) => {
			onUpdate({ ...article, outline })
		},
		[article, onUpdate],
	)

	const handleUploadToProject = useCallback(
		async (file: File, materialId: string) => {
			if (!fileStorageService) return
			try {
				const relativePath = await fileStorageService.uploadMaterialToDraft(index, file)
				if (!relativePath) return

				const currentArticle = articleRef.current

				const updateMaterialsWithPath = (materials?: MaterialItem[]) =>
					(materials || []).map((item) =>
						item.id === materialId ? { ...item, uploadedPath: relativePath } : item,
					)

				const newArticleMaterials = updateMaterialsWithPath(currentArticle.materials)

				const updateOutline = (nodes: OutlineNode[] = []): OutlineNode[] =>
					nodes.map((node) => ({
						...node,
						materials: updateMaterialsWithPath(node.materials),
						children: node.children ? updateOutline(node.children) : node.children,
					}))

				const newOutline = updateOutline(currentArticle.outline)

				onUpdate({ ...currentArticle, materials: newArticleMaterials, outline: newOutline })
			} catch (err) {
				console.error("Failed to upload material to project:", err)
			}
		},
		[fileStorageService, index, onUpdate],
	)

	const handleReferenceFilesChange = useCallback(
		(referenceFiles: ReferenceFileValue[]) => {
			onUpdate({ ...article, referenceFiles })
		},
		[article, onUpdate],
	)

	const handleRemoveCard = useCallback(
		(cardIndex: number) => {
			const newOutline = [...article.outline]
			newOutline.splice(cardIndex, 1)
			const newCardCount = Math.max(1, article.cardCount - 1)
			onUpdate({ ...article, outline: newOutline, cardCount: newCardCount })
		},
		[article, onUpdate],
	)

	const handleCardCountChange = useCallback(
		(newCount: number) => {
			const clamped = Math.max(1, Math.min(20, newCount))
			if (clamped >= article.cardCount) {
				onUpdate({ ...article, cardCount: clamped })
				return
			}
			// Check if any cards being removed have content
			const removedCards = article.outline.slice(clamped)
			const hasContent = removedCards.some(
				(card) => card.text.trim() || (card.materials && card.materials.length > 0),
			)
			if (hasContent) {
				const confirmed = window.confirm(
					t(
						"detail.selfMedia.initPanel.stepDetail.cardCountReduceConfirm",
						"减少卡片数量将移除末尾已有内容的卡片，是否确认？",
					),
				)
				if (!confirmed) return
			}
			const newOutline = article.outline.slice(0, clamped)
			onUpdate({ ...article, cardCount: clamped, outline: newOutline })
		},
		[article, onUpdate, t],
	)

	const handleAiOutline = useCallback(async () => {
		if (generatingOutline) return
		setGeneratingOutline(true)

		const controller = new AbortController()
		abortRef.current = controller

		try {
			if (isCardPlatform) {
				const { outline, cardCount } = await generateCardContent({
					global: globalSettings,
					article,
					model: outlineModel || undefined,
					signal: controller.signal,
				})
				if (outline.length > 0) {
					onUpdate({ ...article, outline, cardCount })
				}
			} else {
				const outline = await generateOutline({
					global: globalSettings,
					article,
					model: outlineModel || undefined,
					signal: controller.signal,
				})
				if (outline.length > 0) {
					onUpdate({ ...article, outline })
				}
			}
		} catch (err) {
			if ((err as Error).name !== "AbortError") {
				console.error("Failed to generate outline:", err)
			}
		} finally {
			setGeneratingOutline(false)
			abortRef.current = null
		}
	}, [generatingOutline, isCardPlatform, globalSettings, article, onUpdate, outlineModel])

	const handleAiOptimize = useCallback(
		async (instruction: string) => {
			if (generatingOutline) return
			setGeneratingOutline(true)
			setOptimizePopoverOpen(false)

			const controller = new AbortController()
			abortRef.current = controller

			try {
				if (isCardPlatform) {
					const { outline, cardCount } = await optimizeCardContent({
						global: globalSettings,
						article,
						instruction,
						model: outlineModel || undefined,
						signal: controller.signal,
					})
					if (outline.length > 0) {
						onUpdate({ ...article, outline, cardCount })
					}
				} else {
					const outline = await optimizeOutline({
						global: globalSettings,
						article,
						instruction,
						model: outlineModel || undefined,
						signal: controller.signal,
					})
					if (outline.length > 0) {
						onUpdate({ ...article, outline })
					}
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
		[generatingOutline, isCardPlatform, globalSettings, article, onUpdate, outlineModel],
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

	const isExpanded = alwaysExpanded || expanded

	return (
		<div
			className={cn(
				hideHeader
					? "w-full space-y-6"
					: "group rounded-lg border bg-card p-4 shadow-xs transition-all duration-300 hover:bg-accent/30 sm:p-5",
			)}
		>
			{/* Accordion header row - visible only when not hideHeader */}
			{!hideHeader && (
				<div className="flex items-start gap-4">
					{/* Step badge */}
					<Badge className="mt-1 h-6 w-6 shrink-0 rounded-md px-0 text-xs">
						{index + 1}
					</Badge>

					{/* Inputs section */}
					<div className="grid min-w-0 flex-1 grid-cols-1 gap-3 md:grid-cols-12">
						<div className="space-y-1 md:col-span-8">
							<Input
								type="text"
								className="h-9 text-sm font-semibold"
								placeholder={t(
									"detail.selfMedia.initPanel.stepTopic.titlePlaceholder",
								)}
								value={article.title}
								onChange={(e) => handleFieldChange("title", e.target.value)}
							/>
							{!isExpanded && (article.description || article.notes) && (
								<p className="line-clamp-1 px-2 text-xs text-muted-foreground/80">
									{article.description || article.notes}
								</p>
							)}
						</div>

						<div className="flex items-center md:col-span-4">
							<div className="relative w-full">
								<Folder
									className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/45"
									size={12}
								/>
								<Input
									type="text"
									className="h-9 pl-7 text-xs"
									placeholder={t(
										"detail.selfMedia.initPanel.stepTopic.folderPlaceholder",
										"归档目录",
									)}
									value={article.folderName}
									onChange={(e) =>
										handleFieldChange("folderName", e.target.value)
									}
								/>
							</div>
						</div>
					</div>

					{/* Row control actions */}
					<div className="flex shrink-0 items-center gap-1.5 pt-0.5">
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className={cn(
								"size-8",
								expanded ? "text-primary" : "text-muted-foreground",
							)}
							onClick={() => setExpanded(!expanded)}
							title={t(
								expanded
									? "detail.selfMedia.initPanel.stepTopic.collapseDetail"
									: "detail.selfMedia.initPanel.stepTopic.expandDetail",
							)}
						>
							<ChevronDown
								size={14}
								className={cn(
									"transition-transform duration-300",
									expanded && "rotate-180",
								)}
							/>
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className="size-8 text-muted-foreground hover:text-destructive"
							onClick={onRemove}
						>
							<Trash2 size={14} />
						</Button>
					</div>
				</div>
			)}

			{/* Collapsible/Always open workspace section */}
			{isExpanded && (
				<ArticleCardWorkspace
					article={article}
					hideHeader={hideHeader}
					showFolderField={showFolderField}
					isCardPlatform={isCardPlatform}
					hasOutline={hasOutline}
					generatingOutline={generatingOutline}
					outlineModel={outlineModel}
					optimizePopoverOpen={optimizePopoverOpen}
					optimizeInstruction={optimizeInstruction}
					outlineActionRef={outlineActionRef}
					fileStorageService={fileStorageService}
					onFieldChange={handleFieldChange}
					onCardCountChange={handleCardCountChange}
					onReferenceFilesChange={handleReferenceFilesChange}
					onOutlineButtonClick={handleOutlineButtonClick}
					onOptimizeInstructionChange={setOptimizeInstruction}
					onOutlineModelChange={setOutlineModel}
					onAiOptimize={handleAiOptimize}
					onOutlineChange={handleOutlineChange}
					onRemoveCard={handleRemoveCard}
					onPersistDraft={onPersistDraft}
					onUploadToProject={handleUploadToProject}
				/>
			)}
		</div>
	)
}
