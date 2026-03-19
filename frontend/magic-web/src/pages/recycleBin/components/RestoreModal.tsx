"use client"

import { useTranslation } from "react-i18next"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"

export function RestoreModal({
	open,
	onOpenChange,
	title,
	statusMessage,
	confirmDisabled,
	onConfirm,
}: RestoreModalProps) {
	const { t } = useTranslation("super")

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent
				className="gap-4 rounded-[10px] border border-border bg-card p-6 shadow-lg"
				data-testid="recycle-bin-restore-modal"
			>
				<AlertDialogHeader className="gap-2 text-left">
					<AlertDialogTitle className="text-lg font-semibold leading-normal text-foreground">
						{title}
					</AlertDialogTitle>
					{statusMessage ? (
						<div
							className="text-sm font-normal leading-normal text-muted-foreground"
							data-testid="recycle-bin-restore-status"
						>
							{statusMessage}
						</div>
					) : null}
				</AlertDialogHeader>

				<AlertDialogFooter className="flex-row justify-end gap-2">
					<AlertDialogCancel
						className="h-9 rounded-lg px-4 shadow-sm"
						data-testid="recycle-bin-restore-cancel"
					>
						{t("recycleBin.restoreModal.cancel")}
					</AlertDialogCancel>
					<AlertDialogAction
						className="h-9 rounded-lg bg-primary px-4 text-primary-foreground shadow-sm hover:bg-primary/90"
						onClick={onConfirm}
						disabled={confirmDisabled}
						data-testid="recycle-bin-restore-confirm"
					>
						{t("recycleBin.restoreModal.confirm")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}

interface RestoreModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	statusMessage?: string
	confirmDisabled?: boolean
	onConfirm: () => void
}
