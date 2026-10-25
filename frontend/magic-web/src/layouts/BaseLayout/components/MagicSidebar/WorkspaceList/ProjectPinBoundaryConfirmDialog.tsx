import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import DeleteDangerModal, { DangerLevel } from "@/components/business/DeleteDangerModal"

export type ProjectPinBoundaryAction = "pin" | "unpin"

interface ConfirmationRequest {
	action: ProjectPinBoundaryAction
	projectName: string
}

interface UseProjectPinBoundaryConfirmationResult {
	requestConfirmation: (request: ConfirmationRequest) => Promise<boolean>
	confirmationDialog: ReactNode
	isConfirmationOpen: boolean
}

/** Reuses the file-area confirmation modal for a completed drop. */
export function useProjectPinBoundaryConfirmation(): UseProjectPinBoundaryConfirmationResult {
	const { t } = useTranslation("super")
	const [pending, setPending] = useState<ConfirmationRequest | null>(null)
	const resolverRef = useRef<((confirmed: boolean) => void) | null>(null)

	const finish = useCallback((confirmed: boolean) => {
		const resolver = resolverRef.current
		resolverRef.current = null
		setPending(null)
		resolver?.(confirmed)
	}, [])

	const requestConfirmation = useCallback((request: ConfirmationRequest) => {
		return new Promise<boolean>((resolve) => {
			// Drops are serialized; resolve the previous request before replacing it.
			resolverRef.current?.(false)
			resolverRef.current = resolve
			setPending(request)
		})
	}, [])

	useEffect(() => {
		return () => {
			resolverRef.current?.(false)
			resolverRef.current = null
		}
	}, [])

	const confirmationDialog = pending ? (
		<DeleteDangerModal
			title={t(
				pending.action === "pin"
					? "project.confirmPinOnReorderTitle"
					: "project.confirmUnpinOnReorderTitle",
			)}
			content={
				<p className="text-sm text-muted-foreground">
					{t(
						pending.action === "pin"
							? "project.confirmPinOnReorder"
							: "project.confirmUnpinOnReorder",
						{ projectName: pending.projectName },
					)}
				</p>
			}
			showDeleteText={false}
			dangerLevel={DangerLevel.Normal}
			okText={t("common.confirm", { defaultValue: "确认" })}
			onSubmit={() => finish(true)}
			onClose={() => finish(false)}
		/>
	) : null

	return { requestConfirmation, confirmationDialog, isConfirmationOpen: pending !== null }
}
