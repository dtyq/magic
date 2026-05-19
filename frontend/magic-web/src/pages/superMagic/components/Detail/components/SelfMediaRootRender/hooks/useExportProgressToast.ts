import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import type { ExportProgress } from "./useExportZip"

/**
 * Shows sonner toast notifications for export progress/success/error.
 * Used by all platform shells that support ZIP export.
 */
export function useExportProgressToast(progress: ExportProgress, toastId: string) {
	const { t } = useTranslation("super")

	useEffect(() => {
		const { status, current, total } = progress
		if (status === "running") {
			toast.loading(t("detail.selfMedia.export.running", { current, total }), {
				id: toastId,
			})
		} else if (status === "done") {
			toast.success(t("detail.selfMedia.export.success"), { id: toastId })
		} else if (status === "error") {
			toast.error(t("detail.selfMedia.export.failed"), { id: toastId })
		}
	}, [progress, t, toastId])
}
