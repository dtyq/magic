"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/shadcn-ui/input"
import type { RecycleBinItem } from "./recycle-bin-domain"
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
	items,
	confirmationPhrase,
	open,
	onOpenChange,
	title,
	description,
	onConfirm,
	confirmLoading = false,
}: DeleteModalProps) {
	const { t } = useTranslation("super")
	const [value, setValue] = useState("")
	useEffect(() => {
		setValue("")
	}, [open, confirmationPhrase])
	const canConfirm = !confirmationPhrase || value === confirmationPhrase

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

				{items && (
					<div className="space-y-3 px-4 pb-4">
						<ul className="max-h-56 overflow-y-auto rounded-lg border p-2 text-xs">
							{items.map((item) => (
								<li key={item.id} className="space-y-1 px-1 py-2">
									<div className="break-words font-medium">{item.title}</div>
									<div className="break-words text-muted-foreground">
										{item.path}
									</div>
								</li>
							))}
						</ul>
						<p className="text-xs text-destructive">
							{t("fileManager.recycle.permanentWarning")}
						</p>
						<label className="block space-y-2 text-xs">
							<span>
								{t("fileManager.confirmation.typePhrase", {
									phrase: confirmationPhrase,
								})}
							</span>
							<Input
								value={value}
								onChange={(event) => setValue(event.target.value)}
								autoComplete="off"
							/>
						</label>
					</div>
				)}
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
						onClick={(event) => {
							if (items) event.preventDefault()
							if (canConfirm && !confirmLoading) onConfirm()
						}}
						disabled={confirmLoading || !canConfirm}
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
	items?: RecycleBinItem[]
	confirmationPhrase?: string
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description: string
	onConfirm: () => void
	confirmLoading?: boolean
}
