import { useMemo } from "react"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import {
	NodeViewContent,
	NodeViewWrapper,
	type ReactNodeViewProps,
} from "@/infrastructure/editors/tiptap/react"
import {
	ClipboardPaste,
	Expand,
	MessageSquareText,
	MoreHorizontal,
	Plus,
	Trash2,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { cn } from "@/utils/cn"
import { useIsMobile } from "@/hooks/useIsMobile"
import { isWechatInstruction, parseWechatChat } from "../../extensions/wechat-chat-history/parser"
import { useWechatChatActions } from "./context"
import { useWechatChatTitle } from "./useWechatChatTitle"

export default function ChatBlock({ node, deleteNode, editor, getPos }: ReactNodeViewProps) {
	const { t } = useTranslation("super")
	const mobile = useIsMobile()
	const actions = useWechatChatActions()
	const id = node.attrs.id as string
	const expanded = actions?.activeId === id
	const content = useMemo<JSONContent[]>(() => node.toJSON().content ?? [], [node])
	const snapshot = useMemo(() => parseWechatChat(content), [content])
	const emptySource = content
		.filter((paragraph) => !isWechatInstruction(paragraph))
		.every((paragraph) => !paragraph.content?.length)
	const title = useWechatChatTitle(snapshot.participants)
	const last = snapshot.messages.at(-1)
	const pasteHint = mobile
		? t("wechatChat.mobilePasteHint")
		: t("wechatChat.desktopPasteHint", {
				shortcut: /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
					? "⌘ V"
					: "Ctrl V",
			})
	return (
		<NodeViewWrapper
			as="section"
			data-chat-id={id}
			data-chat-expanded={expanded ? "true" : "false"}
			className={cn(
				"my-3 rounded-xl border border-border bg-background",
				expanded ? "w-full" : "w-[calc(100%-24px)] max-w-[560px]",
			)}
			style={actions?.activeId && !expanded ? { display: "none" } : undefined}
		>
			<div
				contentEditable={false}
				className="flex items-start justify-between gap-2 px-4 pt-3"
			>
				<div className="flex min-w-0 items-start gap-2.5">
					<span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground/70">
						<MessageSquareText className="size-4" />
					</span>
					<div className="min-w-0">
						<strong className="block truncate text-sm font-medium">{title}</strong>
						<span className="mt-1 block text-xs text-muted-foreground">
							{t("wechatChat.messageCount", { count: snapshot.messages.length })}
							{last ? ` · ${last.date} ${last.time}` : ""}
						</span>
					</div>
				</div>
				{editor.isEditable && actions && (
					<div className="flex shrink-0 items-center gap-1">
						{!expanded && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 gap-1 px-2 text-xs"
								onClick={() => actions.preview(id)}
							>
								<Expand className="size-4" />
								{t("wechatChat.preview")}
							</Button>
						)}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="size-7"
									aria-label={t("wechatChat.actions")}
								>
									<MoreHorizontal className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onSelect={() => actions.append(id)}>
									<Plus className="size-4" />
									{t("wechatChat.append")}
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={deleteNode}
									className="text-destructive"
								>
									<Trash2 className="size-4" />
									{t("wechatChat.delete")}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				)}
			</div>
			{expanded && emptySource && editor.isEditable && (
				<div contentEditable={false} className="mx-4 mt-3">
					<Button
						type="button"
						variant="outline"
						className="h-auto w-full justify-start gap-3 whitespace-normal border-dashed bg-muted/20 px-3 py-4 text-left"
						onClick={() => {
							const position = getPos()
							if (typeof position !== "number") return
							// 引导只聚焦同一区块的原文段落；仍由既有 paste 和附件上传流程处理。
							const first = editor.state.doc.nodeAt(position)?.firstChild
							const chain = editor.chain()
							if (first && isWechatInstruction(first.toJSON()))
								chain.insertContentAt(position + 1, { type: "paragraph" })
							chain
								.focus()
								.setTextSelection(position + 2)
								.run()
						}}
					>
						<ClipboardPaste className="size-4 shrink-0 text-muted-foreground" />
						<span className="min-w-0">
							<span className="block text-sm font-medium">
								{t("wechatChat.pasteHere")}
							</span>
							<span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
								{pasteHint}
							</span>
						</span>
					</Button>
				</div>
			)}
			{!expanded && last && (
				<div
					contentEditable={false}
					className="mx-4 mt-3 truncate border-l-2 border-border pl-3 text-xs leading-6 text-muted-foreground"
				>
					{last.sender}
					{" · "}
					{last.text || t("wechatChat.attachment")}
				</div>
			)}
			{/* 收起时仅隐藏来源段落，末尾原生 super-placeholder 仍能编辑；不另存处理要求。 */}
			{/* 仅在聊天卡片内将行内输入改为独立输入区；展开时与原文留出间距，收起时保持紧凑。 */}
			{/* 处理要求已独占一块，末尾编辑器辅助换行不再显示；仅改变布局，保留辅助 DOM 和文档结构。 */}
			<NodeViewContent
				className={cn(
					"px-4 pb-3 pt-2 [&_p]:m-0 [&_p]:min-h-6",
					"[&_[data-wechat-instruction='true']>.ProseMirror-separator]:!hidden [&_[data-wechat-instruction='true']>.ProseMirror-trailingBreak]:hidden [&_[data-wechat-instruction='true']>.node-super-placeholder]:block",
					!expanded &&
						"[&>div>p:last-child]:mt-2 [&>div>p:last-child]:border-t [&>div>p:last-child]:border-border [&>div>p:last-child]:pt-3 [&_p:not([data-wechat-instruction='true']):not(:has([data-type='super-placeholder']))]:hidden",
					"[&_.super-placeholder]:!m-0 [&_.super-placeholder]:!block [&_.super-placeholder]:!w-full [&_.super-placeholder]:!rounded-lg [&_.super-placeholder]:!border [&_.super-placeholder]:!border-border [&_.super-placeholder]:!bg-muted/30 [&_.super-placeholder]:!text-sm [&_[data-type='super-placeholder']]:!m-0 [&_[data-type='super-placeholder']]:!block",
					expanded
						? "[&_.super-placeholder]:!h-auto [&_.super-placeholder]:!min-h-24 [&_.super-placeholder]:!p-3 [&_[data-wechat-instruction='true']]:!mt-4"
						: "[&_.super-placeholder]:!min-h-9 [&_.super-placeholder]:!p-2",
				)}
			/>
		</NodeViewWrapper>
	)
}
