import { useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import PublishScopeNoticeDialog from "@/pages/superMagic/components/PublishScopeNoticeDialog"
import { waitForNextAttachmentsRefreshForProject } from "@/pages/superMagic/services/attachmentsTopicSync"
import magicToast from "@/components/base/MagicToaster/utils"
import { useTranslation } from "react-i18next"
import { findPublishScopeFilesOutsideRoot } from "../utils/publish-scope"

// Each editor injects its current attachment state and getter so the check waits for
// the page's refresh flow instead of treating an incomplete empty list as publishable.
interface UsePublishScopeNoticeOptions {
	projectId?: string
	getAttachmentsStatus: () => { isLoaded: boolean; hasError: boolean }
	getAttachments: () => AttachmentItem[]
	publishPath: string | (() => string)
	excludedPaths?: string[]
	prepareBeforeCheck?: () => boolean | Promise<boolean>
}

type ContinueAction = () => void | Promise<void>

/**
 * Checks the already loaded attachment metadata before opening the create-version flow.
 * An empty list is not treated as complete until the page's normal refresh flow settles.
 */
export function usePublishScopeNotice({
	projectId,
	getAttachmentsStatus,
	getAttachments,
	publishPath,
	excludedPaths = [],
	prepareBeforeCheck,
}: UsePublishScopeNoticeOptions) {
	const { t } = useTranslation("crew/market")
	const [isNoticeOpen, setIsNoticeOpen] = useState(false)
	const [outsidePaths, setOutsidePaths] = useState<string[]>([])
	const pendingContinueRef = useRef<ContinueAction | null>(null)
	const checkInFlightRef = useRef(false)

	const checkBeforeContinue = useMemoizedFn(async (continueAction: ContinueAction) => {
		if (checkInFlightRef.current || isNoticeOpen) return
		checkInFlightRef.current = true

		try {
			const initialStatus = getAttachmentsStatus()
			if (projectId && (!initialStatus.isLoaded || initialStatus.hasError)) {
				try {
					const didLoad = await waitForNextAttachmentsRefreshForProject(projectId, {
						timeoutMs: 5000,
					})
					if (!didLoad) {
						magicToast.error(t("publishScopeNotice.attachmentsLoadFailed"))
						return
					}
				} catch (error) {
					console.error("Failed to wait for publish attachment scope:", error)
					magicToast.error(t("publishScopeNotice.attachmentsLoadFailed"))
					return
				}
			}

			if (prepareBeforeCheck && !(await prepareBeforeCheck())) {
				return
			}

			const resolvedPublishPath =
				typeof publishPath === "function" ? publishPath() : publishPath
			const nextOutsidePaths = findPublishScopeFilesOutsideRoot(
				getAttachments(),
				resolvedPublishPath,
			)
				.filter(({ path }) => !excludedPaths.includes(path))
				.map(({ path }) => path)
			if (nextOutsidePaths.length === 0) {
				setOutsidePaths([])
				await continueAction()
				return
			}

			setOutsidePaths(nextOutsidePaths)
			pendingContinueRef.current = continueAction
			setIsNoticeOpen(true)
		} finally {
			checkInFlightRef.current = false
		}
	})

	const handleContinue = useMemoizedFn(async () => {
		const continueAction = pendingContinueRef.current
		pendingContinueRef.current = null
		setIsNoticeOpen(false)
		setOutsidePaths([])
		await continueAction?.()
	})

	const handleCancel = useMemoizedFn(() => {
		pendingContinueRef.current = null
		setIsNoticeOpen(false)
		setOutsidePaths([])
	})

	return {
		checkBeforeContinue,
		noticeDialog: (
			<PublishScopeNoticeDialog
				open={isNoticeOpen}
				publishPath={typeof publishPath === "function" ? publishPath() : publishPath}
				outsidePaths={outsidePaths}
				onContinue={handleContinue}
				onCancel={handleCancel}
			/>
		),
	}
}
