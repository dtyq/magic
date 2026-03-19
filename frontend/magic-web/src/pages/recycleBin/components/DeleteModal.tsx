"use client"

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

export function DeleteModal({
	open,
	onOpenChange,
	title,
	description,
	onConfirm,
	confirmLoading = false,
}: DeleteModalProps) {
	const { t } = useTranslation("super")

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent
				className="w-[384px] max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-xl border border-border bg-background p-0 pb-4 shadow-lg"
				data-testid="recycle-bin-delete-modal"
			>
				<AlertDialogHeader className="gap-1.5 p-4 text-left">
					<AlertDialogTitle className="text-base font-semibold leading-normal text-foreground">
						{title}
					</AlertDialogTitle>
					<AlertDialogDescription className="text-sm font-normal leading-normal text-muted-foreground">
						{description}
					</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter className="mx-0 flex flex-row justify-end gap-3 border-t border-border bg-muted p-4">
					<AlertDialogCancel
						size="sm"
						className="h-8 rounded-lg border border-border bg-background px-3 shadow-sm"
						disabled={confirmLoading}
						data-testid="recycle-bin-delete-cancel"
					>
						{t("recycleBin.deleteModal.cancel")}
					</AlertDialogCancel>
					<AlertDialogAction
						size="sm"
						className="h-8 rounded-lg bg-destructive/20 px-3 text-destructive/60 shadow-sm hover:bg-destructive/20"
						onClick={onConfirm}
						disabled={confirmLoading}
						data-testid="recycle-bin-delete-confirm"
					>
						{confirmLoading
							? t("recycleBin.deleteModal.deleting")
							: t("recycleBin.deleteModal.confirm")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}

interface DeleteModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description: string
	onConfirm: () => void
	confirmLoading?: boolean
}
