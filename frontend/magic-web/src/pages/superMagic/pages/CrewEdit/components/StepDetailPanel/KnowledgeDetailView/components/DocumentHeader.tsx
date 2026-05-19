import { useState, useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { PencilLine, SlidersHorizontal, Trash2 } from "lucide-react"
import { Input } from "@/components/shadcn-ui/input"
import { Badge } from "@/components/shadcn-ui/badge"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Switch } from "@/components/shadcn-ui/switch"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Label } from "@/components/shadcn-ui/label"
import { Button } from "@/components/shadcn-ui/button"
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"
import { CrewKnowledge } from "@/types/crew-knowledge"
import { KnowledgeApi } from "@/apis"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MagicTooltip } from "@/components/base"
import magicToast from "@/components/base/MagicToaster/utils"
import useNavigate from "@/routes/hooks/useNavigate"
import { cn } from "@/lib/utils"
import { RouteName } from "@/routes/constants"
import { useCrewEditStore } from "../../../../context"
import { CREW_EDIT_STEP } from "../../../../store"
import { DOCUMENT_TYPE, FRAGMENT_MODE } from "../constants/document-constants"

/** 小于此宽度隐藏 Badge（拖拽变窄详情区时） */
const HEADER_SHOW_BADGES_MIN_PX = 560
/** 小于此宽度隐藏「预览原文」文案，保留 Switch */
const HEADER_SHOW_PREVIEW_LABEL_MIN_PX = 420

interface DocumentHeaderProps {
	knowledgeCode: string
	document: CrewKnowledge.EmbedDocumentDetail
	knowledgeSourceType?: CrewKnowledge.KnowledgeSourceType
}

function DocumentHeader({ knowledgeCode, document, knowledgeSourceType }: DocumentHeaderProps) {
	const { t } = useTranslation("crew/create")
	const navigate = useNavigate()
	const { crewCode, knowledge } = useCrewEditStore()
	const [isEditing, setIsEditing] = useState(false)
	const [editingBaseName, setEditingBaseName] = useState(
		getDocumentNameParts(document?.name || "")?.baseName || "",
	)
	const [updating, setUpdating] = useState(false)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const headerRowRef = useRef<HTMLDivElement>(null)
	const titleInputRef = useRef<HTMLInputElement>(null)
	const [headerWidthPx, setHeaderWidthPx] = useState(0)
	const { baseName: documentBaseName, extension: documentExtension } = getDocumentNameParts(
		document.name,
	)

	// 判断是否为项目文件或企业知识库类型（这些类型不支持单独删除文档）
	const isProjectOrWikiType =
		knowledgeSourceType === CrewKnowledge.KnowledgeSourceType.PROJECT_FILE ||
		knowledgeSourceType === CrewKnowledge.KnowledgeSourceType.ENTERPRISE_KNOWLEDGE

	useEffect(() => {
		setEditingBaseName(documentBaseName)
	}, [documentBaseName])

	useLayoutEffect(() => {
		if (!isEditing) return
		const el = titleInputRef.current
		if (!el) return
		el.focus()
		el.select()
	}, [isEditing])

	useEffect(() => {
		const el = headerRowRef.current
		if (!el) return
		const ro = new ResizeObserver((entries) => {
			const w = entries[0]?.contentRect.width ?? 0
			setHeaderWidthPx(w)
		})
		ro.observe(el)
		return () => ro.disconnect()
	}, [])

	const headerMeasured = headerWidthPx > 0
	const showBadges = !headerMeasured || headerWidthPx >= HEADER_SHOW_BADGES_MIN_PX
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const showPreviewLabel = !headerMeasured || headerWidthPx >= HEADER_SHOW_PREVIEW_LABEL_MIN_PX
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const previewOriginalLabel = t("knowledgeDetail.previewOriginalDocument")

	/**
	 * 获取文档类型对应的 Badge 文本
	 */
	const getDocTypeBadge = useCallback(
		(docType: number) => {
			switch (docType) {
				case DOCUMENT_TYPE.LOCAL_DOCUMENT:
					return t("knowledgeDetail.importMethod.local")
				case DOCUMENT_TYPE.CUSTOM_CONTENT:
					return t("knowledgeDetail.importMethod.customContent")
				case DOCUMENT_TYPE.PROJECT_FILE:
					return t("knowledgeDetail.importMethod.project")
				case DOCUMENT_TYPE.ENTERPRISE_KNOWLEDGE:
					return t("knowledgeDetail.importMethod.enterpriseWiki")
				default:
					return null
			}
		},
		[t],
	)

	/**
	 * 获取分块模式对应的 Badge 文本
	 */
	const getChunkingModeBadge = useCallback(
		(mode: number) => {
			switch (mode) {
				case FRAGMENT_MODE.CUSTOM:
					return t("knowledgeDetail.chunkingMode.custom")
				case FRAGMENT_MODE.AUTO:
					return t("knowledgeDetail.chunkingMode.auto")
				case FRAGMENT_MODE.HIERARCHY:
					return t("knowledgeDetail.chunkingMode.hierarchy")
				default:
					return null
			}
		},
		[t],
	)

	const docTypeBadge = getDocTypeBadge(document.doc_type)
	const chunkingModeBadge = getChunkingModeBadge(document.fragment_config?.mode || 0)

	const handleSaveTitle = useCallback(async () => {
		if (!editingBaseName.trim()) {
			magicToast.error(t("knowledgeDetail.titleRequired"))
			return
		}

		const nextDocumentName = buildDocumentName({
			baseName: editingBaseName.trim(),
			extension: documentExtension,
		})

		if (nextDocumentName === document.name) {
			setIsEditing(false)
			return
		}

		setUpdating(true)
		try {
			await KnowledgeApi.updateCrewKnowledgeDocument({
				knowledge_code: knowledgeCode,
				document_code: document.code,
				name: nextDocumentName,
				enabled: document.enabled,
				fragment_config: document.fragment_config,
			})
			magicToast.success(t("knowledgeDetail.updateTitleSuccess"))
			setIsEditing(false)
			// 刷新文档详情
			await knowledge.fetchDocumentDetail(knowledgeCode, document.code)
			// 刷新左侧文档列表
			await knowledge.fetchDocumentList(knowledgeCode)
		} catch (error) {
			magicToast.error(t("knowledgeDetail.updateTitleFailed"))
		} finally {
			setUpdating(false)
		}
	}, [editingBaseName, document, documentExtension, knowledgeCode, knowledge, t])

	/**
	 * 获取文档类型字符串（用于路由导航）
	 */
	const getDocumentTypeString = useCallback((docType: number): string => {
		switch (docType) {
			case DOCUMENT_TYPE.LOCAL_DOCUMENT:
				return "local"
			case DOCUMENT_TYPE.CUSTOM_CONTENT:
				return "custom"
			case DOCUMENT_TYPE.PROJECT_FILE:
				return "project"
			case DOCUMENT_TYPE.ENTERPRISE_KNOWLEDGE:
				return "wiki"
			default:
				return "local"
		}
	}, [])

	const handleOpenSegmentationSettings = useCallback(() => {
		if (!crewCode) return
		const documentTypeString = getDocumentTypeString(document.doc_type)
		navigate({
			name: RouteName.CrewEdit,
			params: { id: crewCode },
			query: {
				panel: CREW_EDIT_STEP.KnowledgeBase,
				code: knowledgeCode,
				mode: "edit",
				type: documentTypeString,
				docCode: document.code,
			},
		})
	}, [navigate, crewCode, knowledgeCode, document.code, document.doc_type, getDocumentTypeString])

	const handleConfirmDelete = useCallback(async () => {
		setDeleting(true)
		try {
			const success = await knowledge.deleteDocument(knowledgeCode, document.code)
			if (success) {
				magicToast.success(t("knowledgeDetail.deleteDocumentSuccess"))
				setDeleteDialogOpen(false)
			} else {
				magicToast.error(t("knowledgeDetail.deleteDocumentFailed"))
			}
		} catch (error) {
			magicToast.error(t("knowledgeDetail.deleteDocumentFailed"))
		} finally {
			setDeleting(false)
		}
	}, [knowledgeCode, document.code, knowledge, t])

	return (
		<>
			<div
				ref={headerRowRef}
				className="flex h-11 max-h-11 min-h-11 min-w-0 shrink-0 items-center gap-2 overflow-hidden border-b border-border px-3"
			>
				{/* Figma TitleBadgeGroup：标题、编辑、Badge 同一行靠左 */}
				<div className="flex min-w-0 flex-1 items-center gap-2">
					{isEditing ? (
						<div className="relative min-w-0 max-w-[220px] flex-1">
							<Input
								ref={titleInputRef}
								value={editingBaseName}
								onChange={(e) => setEditingBaseName(e.target.value)}
								onBlur={handleSaveTitle}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										void handleSaveTitle()
									} else if (e.key === "Escape") {
										setEditingBaseName(documentBaseName)
										setIsEditing(false)
									}
								}}
								disabled={updating}
								className={cn(
									"box-border h-7 max-h-7 min-h-7 min-w-0 flex-1 px-2 py-0 text-sm font-medium leading-none shadow-none",
									documentExtension ? "pr-14" : undefined,
									"focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:ring-offset-0",
								)}
							/>
							{documentExtension ? (
								<span className="pointer-events-none absolute inset-y-0 right-2 inline-flex items-center text-sm text-muted-foreground">
									{documentExtension}
								</span>
							) : null}
						</div>
					) : (
						<>
							<h3 className="min-w-0 truncate text-sm font-medium leading-4 text-foreground">
								{document.name}
							</h3>
							{/* 项目文件和企业知识库类型不显示重命名按钮 */}
							{!isProjectOrWikiType && (
								<Button
									variant="ghost"
									size="icon"
									className="size-6 shrink-0"
									onClick={() => setIsEditing(true)}
								>
									<PencilLine className="size-4" aria-hidden />
								</Button>
							)}
						</>
					)}
					{showBadges && docTypeBadge ? (
						<div className="flex shrink-0 items-center gap-2">
							<Badge variant="outline">{docTypeBadge}</Badge>
							{chunkingModeBadge && (
								<Badge variant="outline">{chunkingModeBadge}</Badge>
							)}
						</div>
					) : null}
				</div>

				{/* TODO: 原文预览功能暂时隐藏，后续开启 */}
				{/* <div className="flex shrink-0 items-center gap-1">
				{showPreviewLabel ? (
					<Label
						htmlFor="preview-switch"
						className="cursor-pointer whitespace-nowrap text-xs"
					>
						{previewOriginalLabel}
					</Label>
				) : null}
				{showPreviewLabel ? (
					<Switch
						checked={knowledge.showOriginalPreview}
						onCheckedChange={() => knowledge.toggleOriginalPreview()}
						id="preview-switch"
					/>
				) : (
					<MagicTooltip title={previewOriginalLabel} placement="top">
						<span className="inline-flex items-center">
							<Switch
								checked={knowledge.showOriginalPreview}
								onCheckedChange={() => knowledge.toggleOriginalPreview()}
								id="preview-switch"
								aria-label={previewOriginalLabel}
							/>
						</span>
					</MagicTooltip>
				)}
			</div> */}

				{/* 分段配置按钮 - 所有类型都支持 */}
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-6 shrink-0"
					aria-label={t("knowledgeDetail.segmentationSettingsAria")}
					onClick={handleOpenSegmentationSettings}
				>
					<SlidersHorizontal className="size-4" aria-hidden />
				</Button>

				{/* 项目文件和企业知识库类型不显示删除按钮 */}
				{!isProjectOrWikiType && (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-6 shrink-0"
						aria-label={t("knowledgeDetail.deleteDocumentAria")}
						onClick={() => setDeleteDialogOpen(true)}
					>
						<Trash2 className="size-4" aria-hidden />
					</Button>
				)}
			</div>

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent size="sm" className="gap-0 p-0">
					<AlertDialogHeader className="gap-1.5 px-4 py-4 text-left">
						<AlertDialogTitle>{t("knowledgeDetail.deleteDocument")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("knowledgeDetail.deleteDocumentConfirm", { name: document.name })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="mx-0 mb-0 flex flex-row justify-end gap-2 rounded-b-xl border-t bg-muted p-4">
						<AlertDialogCancel size="sm" className="min-w-0" disabled={deleting}>
							{t("common.cancel")}
						</AlertDialogCancel>
						<Button
							type="button"
							size="sm"
							variant="destructive"
							className="min-w-0"
							disabled={deleting}
							onClick={() => void handleConfirmDelete()}
						>
							{t("common.delete")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}

export default observer(DocumentHeader)

function getDocumentNameParts(name: string) {
	const lastDotIndex = name.lastIndexOf(".")
	if (lastDotIndex <= 0 || lastDotIndex === name.length - 1) {
		return {
			baseName: name,
			extension: "",
		}
	}

	return {
		baseName: name.slice(0, lastDotIndex),
		extension: name.slice(lastDotIndex),
	}
}

function buildDocumentName({ baseName, extension }: { baseName: string; extension: string }) {
	return `${baseName}${extension}`
}
