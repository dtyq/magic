import { useTranslation } from "react-i18next"
import { useBoolean, useMemoizedFn } from "ahooks"
import type { OpenableProps } from "@/opensource/utils/react"
import { AlertTriangle } from "lucide-react"
import { useMemo, useState } from "react"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/opensource/components/shadcn-ui/dialog"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Input } from "@/opensource/components/shadcn-ui/input"
import { cn } from "@/opensource/lib/utils"
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"

// 危险等级
export enum DangerLevel {
	/* 普通 */
	Normal = "normal",
	/* 危险 */
	Danger = "danger",
}

interface DeleteDangerModalProps {
	// 标题
	title?: string
	// 提示内容
	content: string | React.ReactNode
	// 描述
	description?: string
	// 危险等级
	dangerLevel?: DangerLevel
	// 是否二次确认
	needConfirm?: boolean
	// 是否显示删除文本
	showDeleteText?: boolean
	// 确认文本
	okText?: string
	// 确认按钮（支持异步）
	onSubmit?: () => void | Promise<void>
	// 自定义类名
	className?: string
}

function DeleteDangerModal({
	title,
	content,
	needConfirm = false,
	showDeleteText = true,
	description,
	dangerLevel = DangerLevel.Danger,
	okText,
	onSubmit,
	onClose,
	className,
}: OpenableProps<DeleteDangerModalProps>) {
	const { t } = useTranslation("interface")
	const isMobile = useIsMobile()

	const [open, { setFalse }] = useBoolean(true)
	const [focus, { setTrue: openFocus, setFalse: closeFocus }] = useBoolean(false)
	const [confirmText, setConfirmText] = useState<string>("")
	const [loading, { setTrue: setLoadingTrue, setFalse: setLoadingFalse }] = useBoolean(false)

	const onCancel = useMemoizedFn(() => {
		setFalse()
		closeFocus()
		onClose?.()
	})

	const onConfirm = useMemoizedFn(async () => {
		if (loading) return

		setLoadingTrue()
		try {
			await onSubmit?.()
			onCancel()
		} finally {
			setLoadingFalse()
		}
	})

	const disable = useMemo(() => {
		return needConfirm ? !(confirmText === content) : false
	}, [content, confirmText, needConfirm])

	// 确定对话框尺寸: PC端 384px(md), 移动端 320px(sm)
	const effectiveSize = isMobile ? "sm" : "md"
	const widthClass = effectiveSize === "sm" ? "w-[320px]" : "w-[384px]"

	// 按钮变体
	const buttonVariant = dangerLevel === DangerLevel.Danger ? "destructive" : "default"

	// Icon 容器
	const IconContainer = () => (
		<div
			className={cn(
				"flex size-10 shrink-0 items-center justify-center rounded-lg",
				dangerLevel === DangerLevel.Danger ? "bg-destructive/10" : "bg-muted",
			)}
		>
			<AlertTriangle
				className={cn(
					"size-6",
					dangerLevel === DangerLevel.Danger ? "text-destructive" : "text-primary",
				)}
			/>
		</div>
	)

	// 描述内容
	const DescriptionContent = () => {
		if (needConfirm) {
			return (
				<div className="space-y-2">
					<p
						className="text-sm text-muted-foreground"
						data-testid="delete-danger-modal-confirm-tip"
					>
						<span>{t("deleteConfirmTip1")} </span>
						<span
							className="text-destructive"
							data-testid="delete-danger-modal-confirm-content"
						>
							{content}
						</span>
						<span> {t("deleteConfirmTip2")}</span>
					</p>
					{!focus ? (
						<button
							type="button"
							className="min-h-9 w-full cursor-text rounded-md border border-input bg-transparent px-3 py-2 text-left text-sm text-muted-foreground shadow-xs transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
							onClick={openFocus}
							data-testid="delete-danger-modal-fake-input"
						>
							<span className="break-words">
								{t("pleaseInput1")}{" "}
								<span className="text-destructive">{content}</span>{" "}
								{t("pleaseInput2")}
							</span>
						</button>
					) : (
						<Input
							className="h-9"
							value={confirmText}
							onChange={(e) => setConfirmText(e.target.value)}
							autoFocus
							data-testid="delete-danger-modal-confirm-input"
						/>
					)}
				</div>
			)
		}

		if (showDeleteText) {
			return (
				<>
					<DialogDescription
						className="text-sm text-muted-foreground"
						data-testid="delete-danger-modal-description"
					>
						<span>{t("deleteConfirm")} </span>
						<span
							className="text-destructive"
							data-testid="delete-danger-modal-content-text"
						>
							{content}
						</span>
						<span>?</span>
					</DialogDescription>
					{description && (
						<p
							className="text-sm text-muted-foreground"
							data-testid="delete-danger-modal-additional-description"
						>
							{description}
						</p>
					)}
				</>
			)
		}

		return (
			<DialogDescription
				className="text-sm text-muted-foreground"
				data-testid="delete-danger-modal-description"
			>
				{content}
			</DialogDescription>
		)
	}

	return (
		<Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
			<DialogContent
				className={cn("z-dialog gap-0 p-0", widthClass, className)}
				data-testid="delete-danger-modal"
			>
				{/* Header Section */}
				<div className="p-4">
					<div
						className={cn(
							"flex gap-3.5",
							effectiveSize === "sm" && "flex-col items-center",
						)}
						data-testid="delete-danger-modal-content"
					>
						<IconContainer />
						<div
							className={cn(
								"flex-1 space-y-1.5",
								effectiveSize === "sm" && "w-full text-center",
							)}
						>
							<DialogTitle
								className="text-base font-semibold"
								data-testid="delete-danger-modal-title"
							>
								{title || t("deleteConfirmTitle")}
							</DialogTitle>
							<DescriptionContent />
						</div>
					</div>
				</div>

				{/* Footer Section - 符合 Figma 设计 */}
				<div
					className={cn(
						"flex items-center gap-2 border-t border-border bg-muted/50 p-4",
						effectiveSize === "sm"
							? "flex-row justify-stretch"
							: "flex-row justify-end",
					)}
					data-testid="delete-danger-modal-footer"
				>
					<Button
						variant="outline"
						size={effectiveSize === "sm" ? "sm" : "sm"}
						onClick={onCancel}
						disabled={loading}
						className={cn(effectiveSize === "sm" && "flex-1")}
						data-testid="delete-danger-modal-cancel-button"
					>
						{t("button.cancel")}
					</Button>
					<Button
						variant={buttonVariant}
						size={effectiveSize === "sm" ? "sm" : "default"}
						onClick={onConfirm}
						disabled={disable || loading}
						className={cn(
							effectiveSize === "sm" && "flex-1",
							"bg-destructive/10 text-destructive hover:bg-destructive/20",
						)}
						data-testid="delete-danger-modal-confirm-button"
						data-disabled={disable || loading}
						data-loading={loading}
						data-danger-level={dangerLevel}
					>
						{okText || t("deleteConfirm")}
					</Button>
				</div>

				{/* Hidden title for accessibility if no title provided */}
				{!title && (
					<VisuallyHidden.Root>
						<DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
					</VisuallyHidden.Root>
				)}
			</DialogContent>
		</Dialog>
	)
}

export default DeleteDangerModal
