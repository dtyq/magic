import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { CircleArrowDown, Pencil } from "lucide-react"
import MagicTooltip from "@/components/base/MagicTooltip"
import { hasMeaningfulData } from "../../../MessageEditor/services/draftService/utils"
import type { SceneEditorQueueContext } from "../../../MainInputContainer/components/editors/types"

export default function QueueDraftNotice({
	context,
	variant = "inline",
	compact = false,
}: {
	context?: SceneEditorQueueContext
	variant?: "inline" | "warning"
	compact?: boolean
}) {
	const { t } = useTranslation("super")
	const draft = context?.queueDraft?.queueDraft
	if (!context || !draft) return null
	if (
		draft.phase === "detached" &&
		!hasMeaningfulData({
			value: context.queueDraft?.value,
			mentionItems: context.queueDraft?.mentionItems,
		})
	)
		return null
	const detached = draft.phase === "detached"
	// 普通来源只占工具栏空间；未知操作结果必须在独立警告区完整显示。
	if ((variant === "inline") !== detached) return null
	const Icon = draft.returnPosition === "original" ? Pencil : CircleArrowDown
	const message =
		draft.phase === "removing"
			? t("messageQueue.removalUnconfirmed")
			: draft.phase === "submitting" || draft.phase === "unconfirmed"
				? t("messageQueue.requeueUnconfirmed")
				: draft.returnPosition === "original"
					? t("messageQueue.detachedForEdit")
					: t("messageQueue.detachedForTail")
	if (detached) {
		return (
			<div
				className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"
				role="status"
			>
				<MagicTooltip title={message}>
					<span className="flex min-w-0 items-center gap-1" aria-label={message}>
						{compact ? (
							<Icon size={16} aria-hidden="true" />
						) : (
							<span className="truncate">
								{draft.returnPosition === "original"
									? t("messageQueue.resendOriginal")
									: t("messageQueue.resendTail")}
							</span>
						)}
					</span>
				</MagicTooltip>
				<MagicTooltip title={t("messageQueue.clearInputDescription")}>
					<Button
						variant="ghost"
						size="sm"
						className="h-7 shrink-0 px-1.5 text-xs text-muted-foreground"
						disabled={context.isQueueOperationPending}
						onClick={() => void context.cancelEditQueueItem()}
					>
						{t("messageQueue.keepDraft")}
					</Button>
				</MagicTooltip>
			</div>
		)
	}
	return (
		<div
			className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border pb-2 pt-1 text-xs text-muted-foreground"
			role="status"
		>
			<span className="min-w-0">{message}</span>
			{draft.phase === "removing" && (
				<Button
					variant="ghost"
					size="sm"
					className="h-7 shrink-0 px-2 text-xs"
					disabled={context.isQueueOperationPending}
					onClick={() => void context.retryQueueDraftRemoval()}
				>
					{t("messageQueue.retryRemoval")}
				</Button>
			)}
			<Button
				variant="outline"
				size="sm"
				className="h-7 shrink-0 px-2 text-xs"
				disabled={context.isQueueOperationPending}
				onClick={() => void context.cancelEditQueueItem()}
			>
				{t("messageQueue.keepDraft")}
			</Button>
		</div>
	)
}
