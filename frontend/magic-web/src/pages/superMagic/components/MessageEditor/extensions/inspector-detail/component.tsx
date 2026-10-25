import { Fragment, useCallback, useEffect, useState, type MouseEvent } from "react"
import { NodeViewWrapper } from "@/infrastructure/editors/tiptap/react"
import type { NodeViewProps, EditorEvents } from "@/infrastructure/editors/tiptap/react"
import type { Editor } from "@/infrastructure/editors/tiptap/core"
import { ChevronRight, Crosshair, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import {
	MentionItemType,
	type ProjectFileMentionData,
} from "@/components/business/MentionPanel/types"
import type { InspectorDetailAttrs } from "./types"
import { INSPECTOR_DETAIL_COLLAPSED_MAX_WIDTH_CLASS } from "./const"
import { getInspectorDetailHeaderLabel } from "./display"
import { InspectorScreenshotPreview } from "./InspectorScreenshotPreview"
import { useHtmlScreenshotMention } from "../../hooks/useHtmlScreenshotMention"
import { sanitizeCopiedInspectorDetailAttrs } from "./copyAttrs"

export const InspectorDetailComponent: React.FC<NodeViewProps> = ({ node, selected, editor }) => {
	return (
		<InspectorDetailView
			attrs={node.attrs as InspectorDetailAttrs}
			selected={selected}
			editor={editor}
		/>
	)
}

interface InspectorDetailViewProps {
	attrs: InspectorDetailAttrs
	selected?: boolean
	editor?: Editor
}

/** 编辑器和历史消息共用同一个标签及详情浮窗，避免复制后变回输入框内展开。 */
export function InspectorDetailView({ attrs, selected = false, editor }: InspectorDetailViewProps) {
	const [open, setOpen] = useState(false)
	const { t } = useTranslation("super")
	const screenshotMention = useHtmlScreenshotMention(attrs.captureId, attrs.screenshotMention)
	const markdown = attrs.sourceType === "markdown" ? attrs.markdownSource : null
	const fullscreenElement = typeof document === "undefined" ? null : document.fullscreenElement
	const portalContainer =
		fullscreenElement &&
		typeof HTMLElement !== "undefined" &&
		fullscreenElement instanceof HTMLElement
			? fullscreenElement
			: undefined
	const Wrapper = editor ? NodeViewWrapper : "span"

	useEffect(() => {
		if (!editor) return
		// 草稿变更或编辑器销毁时关闭详情；开关浮窗本身不更新文档或移动选取位置。
		const close = () => setOpen(false)
		const closeOnDocumentChange = ({ transaction }: EditorEvents["transaction"]) => {
			if (transaction.docChanged) close()
		}
		editor.on("transaction", closeOnDocumentChange)
		editor.on("destroy", close)
		return () => {
			editor.off("transaction", closeOnDocumentChange)
			editor.off("destroy", close)
		}
	}, [editor])

	useEffect(() => setOpen(false), [attrs])

	const parsedStyles: Record<string, string> = (() => {
		try {
			return JSON.parse(attrs.computedStyles || "{}")
		} catch {
			return {}
		}
	})()
	const styleEntries = Object.entries(parsedStyles)
	const parsedAttributes: Record<string, string> = (() => {
		try {
			return JSON.parse(attrs.elementAttributes || "{}")
		} catch {
			return {}
		}
	})()
	const parsedDomContext: {
		parentSelector?: string
		siblingIndex?: number
		sameTagSiblingCount?: number
		sameTagIndex?: number
		previousSibling?: string
		nextSibling?: string
	} = (() => {
		try {
			return JSON.parse(attrs.domContext || "{}")
		} catch {
			return {}
		}
	})()
	const attributeEntries = Object.entries(parsedAttributes)

	const handleMouseDown = useCallback((event: MouseEvent) => {
		// Keep pointer drag from becoming a native text/image drag.
		event.preventDefault()
		event.stopPropagation()
	}, [])

	const headerLabel = getInspectorDetailHeaderLabel(t, attrs.textContent, attrs.tagName)
	const fileData =
		attrs.fileMention?.type === MentionItemType.PROJECT_FILE
			? (attrs.fileMention.data as ProjectFileMentionData)
			: null

	const headerLabelContent = (
		<>
			<Crosshair size={12} className="flex-shrink-0 text-primary" data-drag-preview-icon />
			<span className="min-w-0 flex-1 truncate text-[inherit]">{headerLabel}</span>
		</>
	)

	const headerButton = (
		<button
			type="button"
			className={cn(
				"inline-flex h-5 min-w-0 max-w-full cursor-pointer items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-1.5 text-left font-[inherit] text-xs leading-5",
				// Highlight the existing chip surface instead of adding an outer ring that changes its visual weight.
				selected && "border-primary/70 bg-primary/10",
			)}
			contentEditable={false}
			draggable={false}
			data-testid="inspector-detail-trigger"
		>
			{/* 标签悬浮预览截图，点击打开详情；详情打开后不再叠加悬浮预览。 */}
			{!open && screenshotMention ? (
				<InspectorScreenshotPreview
					mention={screenshotMention}
					trigger={
						<span className="inline-flex min-w-0 items-center gap-1">
							{headerLabelContent}
						</span>
					}
				/>
			) : (
				headerLabelContent
			)}
			<ChevronRight size={12} className="flex-shrink-0 text-primary/70" />
		</button>
	)

	// 折叠态的视觉边框放在按钮上，保持与普通 @ 节点一致的水平间距。
	return (
		<Popover open={open} onOpenChange={setOpen} modal={false}>
			<Wrapper
				{...(editor ? { as: "span" } : {})}
				data-type="inspector-detail"
				data-magic-node-type={editor ? undefined : "inspector-detail"}
				data-magic-node-attrs={
					editor ? undefined : JSON.stringify(sanitizeCopiedInspectorDetailAttrs(attrs))
				}
				draggable={false}
				data-magic-editor-node
				onMouseDown={handleMouseDown}
				className={cn(
					"cursor-grab select-none transition-colors active:cursor-grabbing",
					// Replace ProseMirror's generic node outline with the chip-level selected state below.
					selected && "!outline-none",
					"magic-mention relative top-[1px] !inline-flex !overflow-visible !bg-transparent !p-0 !align-baseline",
					INSPECTOR_DETAIL_COLLAPSED_MAX_WIDTH_CLASS,
				)}
			>
				<PopoverTrigger asChild>{headerButton}</PopoverTrigger>

				{/* 详情通过 Portal 展示，长内容只在浮窗滚动，不撑高输入框。 */}
				{open && (
					<PopoverContent
						container={portalContainer}
						side="top"
						align="start"
						sideOffset={8}
						collisionPadding={12}
						hideWhenDetached
						className="z-popup w-[min(420px,var(--radix-popover-content-available-width))] max-w-[calc(100vw-24px)] cursor-auto select-text p-0"
						aria-label={t("stylePanel.inspector.selectionDetails")}
						onMouseDown={(event) => event.stopPropagation()}
						onClick={(event) => event.stopPropagation()}
					>
						<div className="flex items-center justify-between border-b px-3 py-2">
							<span className="text-sm font-medium">
								{t("stylePanel.inspector.selectionDetails")}
							</span>
							<button
								type="button"
								className="rounded p-1 hover:bg-muted"
								onClick={() => setOpen(false)}
								aria-label={t("common.close")}
							>
								<X size={16} />
							</button>
						</div>
						<span
							className="block max-h-[min(360px,calc(var(--radix-popover-content-available-height)-48px))] space-y-2 overflow-auto overscroll-contain px-3 py-2 text-xs text-foreground/70"
							contentEditable={false}
						>
							{screenshotMention && (
								<InspectorScreenshotPreview mention={screenshotMention} />
							)}
							{fileData && (
								<span className="flex gap-1.5">
									<span className="flex-shrink-0 text-foreground/50">
										{t("stylePanel.inspector.file")}
									</span>
									<span className="min-w-0 break-all text-primary">
										@{fileData.file_name}
									</span>
								</span>
							)}

							{markdown && (
								<span className="block space-y-2">
									<span className="block text-foreground/50">
										{t("stylePanel.inspector.sourceLines", {
											start: markdown.startLine,
											end: markdown.endLine,
										})}
									</span>
									<span className="block">
										{t(
											`stylePanel.inspector.markdownBlockTypes.${markdown.blockType}`,
										)}
									</span>
									{markdown.tableCell && (
										<span className="block">
											{markdown.tableCell.header
												? t("stylePanel.inspector.tableHeaderCell", {
														column: markdown.tableCell.column,
													})
												: t("stylePanel.inspector.tableDataCell", {
														row: markdown.tableCell.row,
														column: markdown.tableCell.column,
													})}
										</span>
									)}
									<span className="block whitespace-pre-wrap break-words">
										{markdown.targetText}
									</span>
									<span className="block text-foreground/50">
										{t("stylePanel.inspector.sourceMarkdown")}
									</span>
									<code className="block whitespace-pre-wrap break-words rounded bg-muted/50 p-2 font-mono text-xs">
										{markdown.sourceText}
									</code>
									{(markdown.sourceTextTruncated ||
										markdown.targetTextTruncated) && (
										<span className="block text-foreground/50">
											{t("stylePanel.inspector.excerptTruncated")}
										</span>
									)}
								</span>
							)}

							{/* Selector */}
							{attrs.selector && (
								<span className="flex gap-1.5">
									<span className="flex-shrink-0 text-foreground/50">
										{t("stylePanel.inspector.selector")}
									</span>
									<code className="min-w-0 break-all font-mono text-foreground/70">
										{attrs.selector}
									</code>
								</span>
							)}

							{/* Size */}
							{attrs.size && (
								<span className="flex gap-1.5">
									<span className="flex-shrink-0 text-foreground/50">
										{t("stylePanel.inspector.size")}
									</span>
									<span>{attrs.size}</span>
								</span>
							)}

							{/* Computed styles */}
							{styleEntries.length > 0 && (
								<span className="block">
									<span className="text-foreground/50">
										{t("stylePanel.inspector.computedStyles")}
									</span>
									<span className="mt-0.5 grid grid-cols-[auto_1fr] gap-x-1.5 gap-y-px rounded bg-muted/50 px-1.5 py-1 font-mono text-[11px]">
										{styleEntries.map(([prop, value]) => (
											<Fragment key={prop}>
												<span className="text-foreground/50">{prop}:</span>
												<span className="min-w-0 break-all text-foreground/70">
													{value}
												</span>
											</Fragment>
										))}
									</span>
								</span>
							)}

							{/* Resource and selector validation */}
							{(attrs.resource || attrs.selector) && (
								<span className="block space-y-1">
									{attrs.resource && (
										<span className="flex gap-1.5">
											<span className="flex-shrink-0 text-foreground/50">
												{t("stylePanel.inspector.resource")}
											</span>
											<code className="min-w-0 break-all font-mono text-foreground/70">
												{attrs.resource}
											</code>
										</span>
									)}
									{attrs.selector && (attrs.selectorMatchCount ?? -1) >= 0 && (
										<span className="flex gap-1.5">
											<span className="flex-shrink-0 text-foreground/50">
												{t("stylePanel.inspector.selectorMatchCount")}
											</span>
											<span>{attrs.selectorMatchCount}</span>
										</span>
									)}
								</span>
							)}

							{/* Element attributes */}
							{attributeEntries.length > 0 && (
								<span className="block">
									<span className="text-foreground/50">
										{t("stylePanel.inspector.elementAttributes")}
									</span>
									<span className="mt-0.5 grid grid-cols-[auto_1fr] gap-x-1.5 gap-y-px rounded bg-muted/50 px-1.5 py-1 font-mono text-[11px]">
										{attributeEntries.map(([name, value]) => (
											<Fragment key={name}>
												<span className="text-foreground/50">{name}:</span>
												<span className="min-w-0 break-all text-foreground/70">
													{value}
												</span>
											</Fragment>
										))}
									</span>
								</span>
							)}

							{/* DOM context */}
							{(parsedDomContext.parentSelector ||
								parsedDomContext.previousSibling ||
								parsedDomContext.nextSibling) && (
								<span className="block space-y-0.5">
									<span className="text-foreground/50">
										{t("stylePanel.inspector.domContext")}
									</span>
									{parsedDomContext.parentSelector && (
										<span className="block break-all font-mono">
											{parsedDomContext.parentSelector}
										</span>
									)}
									<span className="block">
										{t("stylePanel.inspector.elementPosition")}:{" "}
										{parsedDomContext.siblingIndex ?? 0};{" "}
										{t("stylePanel.inspector.sameTagPosition")}:{" "}
										{parsedDomContext.sameTagIndex ?? 0} /{" "}
										{parsedDomContext.sameTagSiblingCount ?? 0}
									</span>
									{parsedDomContext.previousSibling && (
										<span className="block break-all">
											← {parsedDomContext.previousSibling}
										</span>
									)}
									{parsedDomContext.nextSibling && (
										<span className="block break-all">
											→ {parsedDomContext.nextSibling}
										</span>
									)}
								</span>
							)}

							{/* HTML snippet */}
							{attrs.elementHtml && (
								<span className="block">
									<span className="text-foreground/50">
										{t("stylePanel.inspector.elementHtml")}
									</span>
									<code className="mt-0.5 block max-h-20 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/50 px-1.5 py-1 font-mono text-[11px] text-foreground/70">
										{attrs.elementHtml}
									</code>
								</span>
							)}

							{/* Text content */}
							{!markdown && attrs.textContent && (
								<span className="flex gap-1.5">
									<span className="flex-shrink-0 text-foreground/50">
										{t("stylePanel.inspector.textContent")}
									</span>
									<span className="min-w-0 break-all italic">
										&ldquo;{attrs.textContent}&rdquo;
									</span>
								</span>
							)}
						</span>
					</PopoverContent>
				)}
			</Wrapper>
		</Popover>
	)
}
