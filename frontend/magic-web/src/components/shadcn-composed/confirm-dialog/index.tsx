import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"
import { cn } from "@/lib/utils"

interface ConfirmDialogOptions {
	title?: string
	description?: string
	confirmText?: string
	cancelText?: string
	/** Controls confirm button style; "destructive" for delete actions */
	variant?: "default" | "destructive"
	/** Soft red text on tinted bg (Figma dismiss sheet); default solid destructive */
	destructivePresentation?: "solid" | "soft"
	/** sm = equal-width footer buttons on narrow layouts */
	dialogSize?: "default" | "sm"
	onConfirm: () => void
}

interface ConfirmDialogState extends ConfirmDialogOptions {
	open: boolean
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {}

const INITIAL_STATE: ConfirmDialogState = {
	open: false,
	onConfirm: noop,
}

/**
 * useConfirmDialog - Imperative confirm dialog hook.
 *
 * Usage:
 *   const { confirm, dialog } = useConfirmDialog()
 *   // Render {dialog} once in JSX, then call:
 *   confirm({ description: "...", onConfirm: () => doDelete() })
 */
export function useConfirmDialog() {
	const [state, setState] = useState<ConfirmDialogState>(INITIAL_STATE)

	const confirm = useCallback((options: ConfirmDialogOptions) => {
		setState({ ...options, open: true })
	}, [])

	const handleConfirm = useCallback(() => {
		state.onConfirm()
		setState(INITIAL_STATE)
	}, [state])

	const handleCancel = useCallback(() => {
		setState(INITIAL_STATE)
	}, [])

	const dialog = (
		<ConfirmDialog
			open={state.open}
			title={state.title}
			description={state.description}
			confirmText={state.confirmText}
			cancelText={state.cancelText}
			variant={state.variant}
			destructivePresentation={state.destructivePresentation}
			dialogSize={state.dialogSize}
			onConfirm={handleConfirm}
			onCancel={handleCancel}
		/>
	)

	return { confirm, dialog }
}

interface ConfirmDialogProps {
	open: boolean
	title?: string
	description?: string
	confirmText?: string
	cancelText?: string
	variant?: "default" | "destructive"
	destructivePresentation?: "solid" | "soft"
	dialogSize?: "default" | "sm"
	onConfirm: () => void
	onCancel: () => void
}

/**
 * ConfirmDialog - Controlled confirm dialog component.
 * For most cases, prefer the useConfirmDialog hook instead.
 */
export function ConfirmDialog({
	open,
	title,
	description,
	confirmText,
	cancelText,
	variant = "default",
	destructivePresentation = "solid",
	dialogSize = "default",
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	const { t } = useTranslation("interface")

	const useSoftDestructive = variant === "destructive" && destructivePresentation === "soft"

	return (
		<AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
			<AlertDialogContent data-testid="confirm-dialog" size={dialogSize}>
				<AlertDialogHeader>
					<AlertDialogTitle
						data-testid="confirm-dialog-title"
						className={cn(useSoftDestructive && "font-semibold")}
					>
						{title ?? t("deleteConfirmTitle")}
					</AlertDialogTitle>
					{description && (
						<AlertDialogDescription data-testid="confirm-dialog-description">
							{description}
						</AlertDialogDescription>
					)}
				</AlertDialogHeader>
				<AlertDialogFooter
					className={cn(useSoftDestructive && "border-t border-border bg-muted")}
				>
					<AlertDialogCancel
						onClick={onCancel}
						className={cn(dialogSize === "sm" && "flex-1")}
						size="sm"
						data-testid="confirm-dialog-cancel"
					>
						{cancelText ?? t("button.cancel")}
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						variant={
							useSoftDestructive
								? "ghost"
								: variant === "destructive"
									? "destructive"
									: "default"
						}
						size="sm"
						className={cn(
							useSoftDestructive &&
								"flex-1 border-0 bg-destructive/10 !text-destructive shadow-xs hover:bg-destructive/15 hover:!text-destructive sm:text-sm",
							dialogSize === "sm" && "flex-1",
						)}
						data-testid="confirm-dialog-confirm"
					>
						{confirmText ?? t("deleteConfirm")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
