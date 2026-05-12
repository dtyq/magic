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

interface RednoteEditRefreshConfirmDialogProps {
	open: boolean
	onSave: () => void
	onDiscard: () => void
	onCancel: () => void
}

export function RednoteEditRefreshConfirmDialog({
	open,
	onSave,
	onDiscard,
	onCancel,
}: RednoteEditRefreshConfirmDialogProps) {
	const { t } = useTranslation("super")

	return (
		<AlertDialog open={open}>
			<AlertDialogContent data-testid="red-edit-refresh-confirm-dialog">
				<AlertDialogHeader>
					<AlertDialogTitle>
						{t("detail.selfMedia.edit.refreshConfirmTitle")}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{t("detail.selfMedia.edit.refreshConfirmDescription")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel onClick={onCancel} data-testid="red-edit-refresh-cancel-btn">
						{t("detail.selfMedia.edit.cancel")}
					</AlertDialogCancel>
					<AlertDialogAction
						variant="outline"
						onClick={onDiscard}
						data-testid="red-edit-refresh-discard-btn"
					>
						{t("detail.selfMedia.edit.discard")}
					</AlertDialogAction>
					<AlertDialogAction onClick={onSave} data-testid="red-edit-refresh-save-btn">
						{t("detail.selfMedia.edit.save")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
