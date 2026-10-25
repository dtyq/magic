import { useEffect, useRef, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	FILE_SAVE_FAIL_REASON,
	getFileSaveQueue,
	type FileSaveFailReason,
	type FileSaveJob,
} from "../services/fileSaveQueue"

function FileSaveFailureToast({
	fileId,
	failReason,
	persist,
}: {
	fileId: string
	failReason?: FileSaveFailReason
	persist: FileSaveJob["persist"]
}) {
	const { t } = useTranslation("super")
	const queue = getFileSaveQueue()
	const isConflict = failReason === FILE_SAVE_FAIL_REASON.Conflict
	const message = isConflict ? t("detail.fileSave.conflict") : t("detail.fileSave.failed")

	return (
		<div className="flex min-w-[220px] flex-col gap-2">
			<span>{message}</span>
			<div className="flex flex-wrap gap-1.5">
				<Button
					type="button"
					size="sm"
					className="h-6 px-2 text-xs"
					onClick={() => {
						queue.retry(fileId, { persist })
						magicToast.destroy(`file-save-failed-${fileId}`)
					}}
				>
					{t("detail.fileSave.retry")}
				</Button>
				{isConflict ? (
					<Button
						type="button"
						size="sm"
						variant="secondary"
						className="h-6 px-2 text-xs"
						onClick={() => {
							queue.retry(fileId, { persist, overwrite: true })
							magicToast.destroy(`file-save-failed-${fileId}`)
						}}
					>
						{t("detail.fileSave.overwrite")}
					</Button>
				) : null}
				<Button
					type="button"
					size="sm"
					variant="outline"
					className="h-6 px-2 text-xs"
					onClick={() => {
						void queue.restoreRemote(fileId)
						magicToast.destroy(`file-save-failed-${fileId}`)
					}}
				>
					{t("detail.fileSave.restoreRemote")}
				</Button>
			</div>
		</div>
	)
}

function FileSaveFailureWatcher({
	fileId,
	persist,
}: {
	fileId: string
	persist: FileSaveJob["persist"]
}) {
	const queue = getFileSaveQueue()
	const shownRef = useRef(false)
	const revealToken = queue.getFailureRevealToken(fileId)

	useEffect(() => {
		queue.rebindPersist(fileId, persist)
	}, [fileId, persist, queue])

	useEffect(() => {
		const toastKey = `file-save-failed-${fileId}`
		if (shownRef.current) return
		shownRef.current = true
		magicToast.error({
			key: toastKey,
			duration: 0,
			dismissible: true,
			content: (
				<FileSaveFailureToast
					fileId={fileId}
					failReason={queue.getSnapshot(fileId)?.failReason}
					persist={persist}
				/>
			),
		})
		return () => {
			shownRef.current = false
			magicToast.destroy(toastKey)
		}
	}, [fileId, persist, queue, revealToken])

	return null
}

export function FileSaveFailureListener({ persist }: { persist: FileSaveJob["persist"] }) {
	const queue = getFileSaveQueue()
	useSyncExternalStore(queue.subscribe, queue.getRevision, queue.getRevision)

	useEffect(() => {
		void queue.recover()
	}, [queue])

	return (
		<>
			{queue.getFailedFileIds().map((fileId) => (
				<FileSaveFailureWatcher key={fileId} fileId={fileId} persist={persist} />
			))}
		</>
	)
}
