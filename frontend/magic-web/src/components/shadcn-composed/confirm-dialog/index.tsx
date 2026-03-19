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
import { buttonVariants } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"

interface ConfirmDialogOptions {
	title?: string
	description?: string
	confirmText?: string
	cancelText?: string
	/** Controls confirm button style; "destructive" for delete actions */
	variant?: "default" | "destructive"
	onConfirm: () => void
}

interface ConfirmDialogState extends ConfirmDialogOptions {
	open: boolean
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => { }

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
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	const { t } = useTranslation("interface")

	return (
		<AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
			<AlertDialogContent data-testid="confirm-dialog">
				<AlertDialogHeader>
					<AlertDialogTitle data-testid="confirm-dialog-title">
						{title ?? t("deleteConfirmTitle")}
					</AlertDialogTitle>
					{description && (
						<AlertDialogDescription data-testid="confirm-dialog-description">
							{description}
						</AlertDialogDescription>
					)}
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel onClick={onCancel} data-testid="confirm-dialog-cancel">
						{cancelText ?? t("button.cancel")}
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						className={cn(
							variant === "destructive" && buttonVariants({ variant: "destructive" }),
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
