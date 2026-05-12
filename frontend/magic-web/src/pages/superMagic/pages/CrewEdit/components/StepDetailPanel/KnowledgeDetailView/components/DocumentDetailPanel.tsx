import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import { observer } from "mobx-react-lite"
import { useMemoizedFn, useMount } from "ahooks"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/tiptap-utils"
import TopicResizeHandle from "@/pages/superMagic/pages/TopicPage/components/TopicResizeHandle"
import { useCrewEditStore } from "../../../../context"
import { KNOWLEDGE_ORIGINAL_PREVIEW_SPLIT_TRANSITION } from "../layout-transition"
import DocumentHeader from "./DocumentHeader"
import MarkdownSourcePanel from "./MarkdownSourcePanel"
import FormattedContentPanel from "./FormattedContentPanel"
import type { ContentNode } from "../types/content-node"

const SOURCE_PREVIEW_MIN_PX = 200
const FORMATTED_PREVIEW_MIN_PX = 200
const SOURCE_PREVIEW_DEFAULT_PX = 400
const SOURCE_PREVIEW_STORAGE_KEY = "MAGIC:crew-edit-knowledge-source-preview-width"
const PREVIEW_SPLIT_RESIZE_HANDLE_PX = 8

function readStoredSourcePreviewWidth(): number {
	try {
		const raw = localStorage.getItem(SOURCE_PREVIEW_STORAGE_KEY)
		if (!raw) return SOURCE_PREVIEW_DEFAULT_PX
		const n = parseInt(raw, 10)
		if (Number.isNaN(n)) return SOURCE_PREVIEW_DEFAULT_PX
		return Math.max(SOURCE_PREVIEW_MIN_PX, n)
	} catch {
		return SOURCE_PREVIEW_DEFAULT_PX
	}
}

function clampSourceWidthToParent(width: number, parentWidth: number) {
	if (parentWidth <= PREVIEW_SPLIT_RESIZE_HANDLE_PX) return 0
	const maxSource = parentWidth - FORMATTED_PREVIEW_MIN_PX - PREVIEW_SPLIT_RESIZE_HANDLE_PX
	const minSource = Math.min(SOURCE_PREVIEW_MIN_PX, Math.max(0, maxSource))
	const upper = Math.max(minSource, maxSource)
	return Math.max(minSource, Math.min(upper, width))
}

interface OriginalPreviewSplitBodyProps {
	showSplit: boolean
	documentNodes: ContentNode[]
	originalContent: string
}

function OriginalPreviewSplitBody({
	showSplit,
	documentNodes,
	originalContent,
}: OriginalPreviewSplitBodyProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [sourceWidthPx, setSourceWidthPx] = useState(readStoredSourcePreviewWidth)
	const sourceWidthRef = useRef(sourceWidthPx)
	const [isDraggingSplit, setIsDraggingSplit] = useState(false)

	useEffect(() => {
		sourceWidthRef.current = sourceWidthPx
	}, [sourceWidthPx])

	const clampToContainer = useMemoizedFn(() => {
		const el = containerRef.current
		if (!el) return
		const w = el.clientWidth
		if (w <= 0) return
		const next = clampSourceWidthToParent(sourceWidthRef.current, w)
		if (next !== sourceWidthRef.current) {
			sourceWidthRef.current = next
			setSourceWidthPx(next)
			try {
				localStorage.setItem(SOURCE_PREVIEW_STORAGE_KEY, String(next))
			} catch {
				/* ignore */
			}
		}
	})

	useMount(() => {
		queueMicrotask(() => clampToContainer())
	})

	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const ro = new ResizeObserver(() => clampToContainer())
		ro.observe(el)
		return () => ro.disconnect()
	}, [clampToContainer])

	const handleSplitResizeStart = useMemoizedFn((e: ReactMouseEvent<HTMLDivElement>) => {
		e.preventDefault()
		setIsDraggingSplit(true)
		const startX = e.clientX
		const startWidth = sourceWidthRef.current

		const onMove = (moveEvent: MouseEvent) => {
			const parentW = containerRef.current?.clientWidth ?? 0
			const delta = moveEvent.clientX - startX
			const next = clampSourceWidthToParent(startWidth + delta, parentW)
			sourceWidthRef.current = next
			setSourceWidthPx(next)
		}

		const onUp = () => {
			setIsDraggingSplit(false)
			try {
				localStorage.setItem(SOURCE_PREVIEW_STORAGE_KEY, String(sourceWidthRef.current))
			} catch {
				/* ignore */
			}
			document.removeEventListener("mousemove", onMove)
			document.removeEventListener("mouseup", onUp)
		}

		document.addEventListener("mousemove", onMove)
		document.addEventListener("mouseup", onUp)
	})

	const splitTransition = isDraggingSplit ? "none" : KNOWLEDGE_ORIGINAL_PREVIEW_SPLIT_TRANSITION

	return (
		<div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden">
			<div
				className="box-border min-h-0 shrink-0 overflow-hidden border-border"
				style={{
					width: showSplit ? sourceWidthPx : 0,
					opacity: showSplit ? 1 : 0,
					borderRightWidth: showSplit ? 1 : 0,
					borderRightStyle: "solid",
					transition: splitTransition,
				}}
			>
				<div className="h-full min-w-0 overflow-hidden">
					<MarkdownSourcePanel content={originalContent} />
				</div>
			</div>

			{showSplit ? (
				<>
					<div
						className="shrink-0 overflow-hidden"
						style={{
							width: PREVIEW_SPLIT_RESIZE_HANDLE_PX,
							minWidth: PREVIEW_SPLIT_RESIZE_HANDLE_PX,
						}}
					>
						<TopicResizeHandle
							onMouseDown={handleSplitResizeStart}
							className={cn("h-full w-full", isDraggingSplit && "before:opacity-100")}
						/>
					</div>
					<div className="min-h-0 min-w-0 flex-1 overflow-hidden">
						<FormattedContentPanel documentNodes={documentNodes} />
					</div>
				</>
			) : (
				<div className="min-h-0 min-w-0 flex-1 overflow-hidden">
					<FormattedContentPanel documentNodes={documentNodes} />
				</div>
			)}
		</div>
	)
}

interface DocumentDetailPanelProps {
	knowledgeCode: string
}

function DocumentDetailPanel({ knowledgeCode }: DocumentDetailPanelProps) {
	const { t } = useTranslation("crew/create")
	const { knowledge } = useCrewEditStore()

	// 获取当前知识库的 source_type
	const currentKnowledge = knowledge.knowledgeList.find((k) => k.code === knowledgeCode)
	const knowledgeSourceType = currentKnowledge?.source_type

	// 没有选中文档时的完整空状态
	if (!knowledge.documentDetail) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				{knowledge.documentLoading
					? t("knowledgeDetail.loading")
					: t("knowledgeDetail.selectDocument")}
			</div>
		)
	}

	// 有选中文档，始终显示 Header，内容区域根据 loading 状态显示
	return (
		<div className="flex h-full flex-col">
			<DocumentHeader
				knowledgeCode={knowledgeCode}
				document={knowledge.documentDetail}
				knowledgeSourceType={knowledgeSourceType}
			/>

			{/* 内容区域：loading 或正常显示 */}
			{knowledge.documentContentLoading ? (
				<div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
					{t("knowledgeDetail.loading")}
				</div>
			) : (
				<OriginalPreviewSplitBody
					showSplit={false}
					documentNodes={knowledge.documentNodes}
					originalContent={knowledge.originalContent}
				/>
			)}
		</div>
	)
}

export default observer(DocumentDetailPanel)
