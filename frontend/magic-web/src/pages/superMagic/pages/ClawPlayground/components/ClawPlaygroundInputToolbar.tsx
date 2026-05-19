import { MagicTooltip } from "@/components/base"
import magicToast from "@/components/base/MagicToaster/utils"
import { Button } from "@/components/shadcn-ui/button"
import { Skills } from "@/enhance/lucide-react"
import { cn } from "@/lib/utils"
import { Files, MessageCirclePlus } from "lucide-react"
import { memo, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

const pillClassName = "h-7 gap-1 rounded-full border-input px-2.5 text-xs font-normal"

export interface ClawPlaygroundInputToolbarProps {
	variant: "desktop" | "mobile"
	/** Blocks only the New chat action while a task is running */
	isTaskRunning?: boolean
	leadingContent?: ReactNode
	onNewChat: () => void
	onOpenSkills?: () => void
	onOpenFiles?: () => void
}

interface NewChatButtonProps {
	variant: "desktop" | "mobile"
	isTaskRunning: boolean
	hint: string
	className: string
	onClick: () => void
	children: ReactNode
}

function NewChatButtonWithTaskGuard({
	variant,
	isTaskRunning,
	hint,
	className,
	onClick,
	children,
}: NewChatButtonProps) {
	const button = (
		<Button
			type="button"
			variant="outline"
			size="sm"
			className={cn(
				className,
				variant === "mobile" && isTaskRunning && "pointer-events-none",
			)}
			data-testid="claw-playground-toolbar-new-chat"
			disabled={isTaskRunning}
			onClick={onClick}
		>
			{children}
		</Button>
	)

	if (variant === "desktop") {
		return (
			<MagicTooltip title={isTaskRunning ? hint : undefined}>
				<span className="inline-flex">{button}</span>
			</MagicTooltip>
		)
	}

	return (
		<span
			className="inline-flex"
			onClick={() => {
				if (isTaskRunning) magicToast.info(hint)
			}}
		>
			{button}
		</span>
	)
}

function ClawPlaygroundInputToolbarComponent({
	variant,
	isTaskRunning = false,
	leadingContent,
	onNewChat,
	onOpenSkills,
	onOpenFiles,
}: ClawPlaygroundInputToolbarProps) {
	const { t: tSuper } = useTranslation("super")
	const { t: tSidebar } = useTranslation("sidebar")
	const hint = tSuper("clawPlayground.stopTaskBeforeToolbarAction")

	return (
		<div
			className={cn(
				"flex w-full gap-2",
				variant === "mobile"
					? "no-scrollbar items-center overflow-x-auto px-2"
					: "flex-wrap",
			)}
			data-testid="claw-playground-input-toolbar"
		>
			{leadingContent ? (
				<div className="shrink-0" data-testid="claw-playground-toolbar-leading-content">
					{leadingContent}
				</div>
			) : null}
			<NewChatButtonWithTaskGuard
				variant={variant}
				isTaskRunning={isTaskRunning}
				hint={hint}
				className={pillClassName}
				onClick={onNewChat}
			>
				<MessageCirclePlus className="size-4 shrink-0" aria-hidden />
				{tSuper("clawPlayground.toolbarNewChat")}
			</NewChatButtonWithTaskGuard>
			{variant === "mobile" && onOpenFiles ? (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className={pillClassName}
					data-testid="claw-playground-toolbar-files"
					onClick={onOpenFiles}
				>
					<Files className="size-4 shrink-0" aria-hidden />
					{tSuper("topicFiles.fileTitle")}
				</Button>
			) : null}
			<Button
				type="button"
				variant="outline"
				size="sm"
				className={pillClassName}
				data-testid="claw-playground-toolbar-skills"
				onClick={() => onOpenSkills?.()}
			>
				<Skills className="size-4 shrink-0" aria-hidden />
				{tSidebar("skillsLibrary.title")}
			</Button>
		</div>
	)
}

export const ClawPlaygroundInputToolbar = memo(ClawPlaygroundInputToolbarComponent)
