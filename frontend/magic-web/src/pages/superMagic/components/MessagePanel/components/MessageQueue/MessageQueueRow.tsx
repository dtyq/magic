import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
	CircleArrowUp,
	CircleArrowDown,
	GripVertical,
	Loader2,
	Pencil,
	Trash,
	type LucideIcon,
} from "lucide-react"
import { cn } from "@/utils/cn"
import MagicTooltip from "@/components/base/MagicTooltip"
import type { QueuedMessage } from "../../hooks/useMessageQueue"
import type { QueueActions } from "./MessageQueueItems"
import CollapsibleText from "./components/CollapsibleText"
import { normalizeQueuePreviewText, trimQueueContent } from "./utils"

interface QueueAction {
	label: string
	icon: LucideIcon
	onClick: () => void
	loading?: boolean
	destructive?: boolean
	testId: string
}

export default function MessageQueueRow({
	message,
	dragDisabled,
	...props
}: QueueActions & { message: QueuedMessage; dragDisabled?: boolean }) {
	const { t } = useTranslation("super")
	const mobile = props.variant === "mobile"
	const rowRef = useRef<HTMLDivElement | null>(null)
	const handleRef = useRef<HTMLButtonElement | null>(null)
	const actionsMeasureRef = useRef<HTMLDivElement | null>(null)
	const textMeasureRef = useRef<HTMLSpanElement | null>(null)
	const [compact, setCompact] = useState(true)
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: message.id,
		disabled: dragDisabled || message.status !== "pending" || Boolean(message.syncState),
	})
	const disabled = Boolean(
		props.isOperationPending ||
		message.status !== "pending" ||
		message.syncState === "submitted" ||
		message.isDeletingLoading ||
		message.isSendingLoading ||
		message.isEditingLoading,
	)
	// 摘要文本只用于「内容需要多宽」的测量与空内容兜底；实际渲染走富文本，
	// 保证 AI 选取元素、文件提及这些需要节点视图的内容不会退化成原始标记。
	const previewText = useMemo(() => normalizeQueuePreviewText(message.content), [message.content])
	const previewLabel = previewText || t("messageQueue.mobile.emptyContent")
	// 消息列表更新时父组件会重新渲染；缓存裁剪后的对象，避免 RichText 因引用变化销毁并重建
	// ProseMirror 视图，导致队列预览在无关消息更新期间短暂切换。
	const trimmedContent = useMemo(() => trimQueueContent(message.content), [message.content])
	const actions: QueueAction[] = [
		{
			label: t("messageQueue.edit"),
			icon: Pencil,
			onClick: () => props.onStartEdit(message.id),
			testId: "on-start-edit",
		},
		{
			label: t("messageQueue.withdraw"),
			icon: CircleArrowDown,
			onClick: () => props.onWithdraw(message.id),
			testId: "on-withdraw-message",
		},
		{
			label: t("messageQueue.submitNow"),
			icon: CircleArrowUp,
			onClick: () => props.onSendMessage(message.id),
			loading: message.isSendingLoading,
			testId: "on-send-message",
		},
		{
			label: t("messageQueue.delete"),
			icon: Trash,
			destructive: true,
			onClick: () => props.onRemoveMessage(message.id),
			loading: message.isDeletingLoading,
			testId: "on-remove-message",
		},
	]
	const labels = actions.map((action) => action.label).join("/")
	const buttonClass = cn(
		"inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-xs leading-4 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
		mobile
			? "h-8 min-w-8 rounded-lg border border-border bg-card px-2 shadow-sm"
			: "h-6 min-w-6 rounded-sm px-1",
	)

	useLayoutEffect(() => {
		const row = rowRef.current
		const handle = handleRef.current
		const actionsNode = actionsMeasureRef.current
		const text = textMeasureRef.current
		if (!row || !handle || !actionsNode || !text) return
		const measure = () => {
			const style = getComputedStyle(row)
			const available =
				row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
			const gap = parseFloat(style.columnGap) || 0
			// 短文本按实宽；长文本的测量预算最多占行宽三分之一，正文实际仍占剩余空间。
			// 始终测完整文字版，避免隐藏标签后尺寸变小又反复展开；没有固定面板断点。
			const preview = Math.min(text.getBoundingClientRect().width, available / 3)
			setCompact(
				handle.getBoundingClientRect().width +
					actionsNode.getBoundingClientRect().width +
					preview +
					gap * 2 >
					available,
			)
		}
		const observer = new ResizeObserver(measure)
		observer.observe(row)
		observer.observe(actionsNode)
		observer.observe(text)
		measure()
		return () => observer.disconnect()
	}, [labels, previewLabel, mobile])

	return (
		<div
			ref={(node) => {
				rowRef.current = node
				setNodeRef(node)
			}}
			className={cn(
				"relative flex shrink-0 items-center gap-2 [&_p]:m-0",
				mobile ? "px-3 py-2" : "rounded",
				isDragging && "opacity-30",
			)}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			data-testid={mobile ? "mobile-message-queue-item" : "message-queue-item"}
		>
			<button
				ref={(node) => {
					handleRef.current = node
					setActivatorNodeRef(node)
				}}
				type="button"
				className={cn(
					"flex shrink-0 touch-none items-center justify-center text-muted-foreground disabled:opacity-30",
					mobile ? "size-8" : "size-4",
				)}
				{...attributes}
				{...listeners}
				aria-label={t("messageQueue.dragToSort")}
				disabled={disabled || dragDisabled || Boolean(message.syncState)}
			>
				<GripVertical size={16} />
			</button>
			<div
				className={cn(
					"min-w-0 flex-1",
					mobile
						? "text-sm"
						: // 桌面队列不再覆盖 <p> 行高：折叠盒由浏览器按真实行盒裁剪，
							// AI 选取元素这类高内联节点会把行盒撑高，折叠高度自动跟随。
							"text-xs [&_.magic-mention]:!text-[10px] [&_p]:!text-xs",
				)}
			>
				{/* 移动端与桌面走同一条富文本路径：AI 选取元素需要节点视图渲染成标签，
				    纯文本摘要会把 <magic-selection> 序列化标记直接吐出来。 */}
				{mobile && !previewText ? (
					<p className="truncate">{previewLabel}</p>
				) : (
					<CollapsibleText content={trimmedContent} maxLines={1} />
				)}
			</div>
			<div className="flex shrink-0 items-center gap-1">
				{actions.map(({ label, icon: Icon, onClick, loading, destructive, testId }) => (
					<MagicTooltip
						key={testId}
						title={compact ? label : undefined}
						disabled={isDragging}
					>
						<button
							type="button"
							className={cn(
								buttonClass,
								destructive
									? "text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive active:bg-destructive/20"
									: "text-foreground/80 hover:bg-fill hover:text-foreground",
								compact && mobile && "w-8 px-0",
							)}
							aria-label={label}
							disabled={disabled}
							onClick={onClick}
							data-testid={testId}
						>
							{loading ? (
								<Loader2 size={16} className="animate-spin" />
							) : (
								<Icon size={16} />
							)}
							{!compact && <span>{label}</span>}
						</button>
					</MagicTooltip>
				))}
			</div>
			{/* 测量副本只有不可交互的 span，对无障碍树隐藏，不参与行高或焦点顺序。 */}
			<div
				aria-hidden="true"
				className="pointer-events-none invisible absolute inset-0 overflow-hidden"
			>
				<span
					ref={textMeasureRef}
					className={cn(
						"absolute w-max whitespace-nowrap",
						mobile ? "text-sm" : "text-xs",
					)}
				>
					{previewLabel}
				</span>
				<div ref={actionsMeasureRef} className="absolute flex w-max items-center gap-1">
					{actions.map(({ label, icon: Icon, testId }) => (
						<span key={testId} className={buttonClass}>
							<Icon size={16} />
							<span>{label}</span>
						</span>
					))}
				</div>
			</div>
		</div>
	)
}
