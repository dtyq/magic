import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { MagicClawApi, SuperMagicApi, type MagicClawItem } from "@/apis"
import { MAGIC_CLAW_STATUS, type MagicClawStatus } from "@/apis/modules/magicClawStatus"
import { MAGI_CLAW_DISPLAY_STATUS } from "./magiClawDisplayStatus"

interface UseMagiClawCreatedSectionActionsParams {
	claws: MagicClawItem[]
	onRefreshList: () => Promise<unknown>
	onOpenClawPlayground: (clawCode: string) => void
	t: (key: string, values?: Record<string, unknown>) => string
	clawBrandValues: Record<string, unknown>
}

const SANDBOX_STATUS_POLL_INTERVAL_MS = 5 * 1000
const VALID_MAGIC_CLAW_STATUS_SET = new Set<MagicClawStatus>(Object.values(MAGIC_CLAW_STATUS))

export function useMagiClawCreatedSectionActions({
	claws,
	onRefreshList,
	onOpenClawPlayground,
	t,
	clawBrandValues,
}: UseMagiClawCreatedSectionActionsParams) {
	const [activeActionClawCode, setActiveActionClawCode] = useState<string | null>(null)
	const [clawStatusOverrides, setClawStatusOverrides] = useState<
		Record<string, MagicClawStatus | undefined>
	>({})
	const [restartingClawCodes, setRestartingClawCodes] = useState<Record<string, boolean>>({})
	const statusPollingTimerMapRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
	const statusPollingSessionMapRef = useRef(new Map<string, number>())

	function areClawStatusOverridesShallowEqual(
		next: Record<string, MagicClawStatus | undefined>,
		previous: Record<string, MagicClawStatus | undefined>,
	) {
		const nextKeys = Object.keys(next)
		const previousKeys = Object.keys(previous)
		if (nextKeys.length !== previousKeys.length) return false
		return nextKeys.every((key) => next[key] === previous[key])
	}

	useEffect(() => {
		const statusPollingTimerMap = statusPollingTimerMapRef.current
		const statusPollingSessionMap = statusPollingSessionMapRef.current

		return () => {
			statusPollingTimerMap.forEach((timerId) => clearTimeout(timerId))
			statusPollingTimerMap.clear()
			statusPollingSessionMap.clear()
		}
	}, [])

	useEffect(() => {
		const nextClawCodeSet = new Set(claws.map((claw) => claw.code).filter(Boolean))
		setClawStatusOverrides((previousOverrides) => {
			const nextOverrides: Record<string, MagicClawStatus | undefined> = {}

			for (const [clawCode, status] of Object.entries(previousOverrides)) {
				if (!nextClawCodeSet.has(clawCode)) continue

				const nextClaw = claws.find((claw) => claw.code === clawCode)
				if (!nextClaw || nextClaw.status === status) continue

				nextOverrides[clawCode] = status
			}

			if (areClawStatusOverridesShallowEqual(nextOverrides, previousOverrides))
				return previousOverrides

			return nextOverrides
		})
	}, [claws])

	function normalizeMagicClawStatus(status?: string | null): MagicClawStatus {
		if (status && VALID_MAGIC_CLAW_STATUS_SET.has(status as MagicClawStatus))
			return status as MagicClawStatus

		return MAGIC_CLAW_STATUS.UNKNOWN
	}

	function setClawStatusOverride(clawCode: string, status?: MagicClawStatus) {
		setClawStatusOverrides((previousOverrides) => {
			if (!status) {
				if (!(clawCode in previousOverrides)) return previousOverrides

				const nextOverrides = { ...previousOverrides }
				delete nextOverrides[clawCode]
				return nextOverrides
			}

			if (previousOverrides[clawCode] === status) return previousOverrides
			return {
				...previousOverrides,
				[clawCode]: status,
			}
		})
	}

	function getDisplayedClawStatus(claw: MagicClawItem) {
		if (!claw.code) return claw.status
		if (restartingClawCodes[claw.code]) return MAGI_CLAW_DISPLAY_STATUS.RESTARTING
		return clawStatusOverrides[claw.code] ?? claw.status
	}

	function setRestartingClawCode(clawCode: string, isRestarting: boolean) {
		setRestartingClawCodes((previousState) => {
			if (!isRestarting) {
				if (!previousState[clawCode]) return previousState

				const nextState = { ...previousState }
				delete nextState[clawCode]
				return nextState
			}

			if (previousState[clawCode]) return previousState
			return {
				...previousState,
				[clawCode]: true,
			}
		})
	}

	function stopClawStatusPolling(clawCode: string) {
		const timerId = statusPollingTimerMapRef.current.get(clawCode)
		if (timerId) {
			clearTimeout(timerId)
			statusPollingTimerMapRef.current.delete(clawCode)
		}

		const nextSessionId = (statusPollingSessionMapRef.current.get(clawCode) ?? 0) + 1
		statusPollingSessionMapRef.current.set(clawCode, nextSessionId)
	}

	function scheduleClawStatusPoll({
		clawCode,
		topicId,
		pollingSessionId,
	}: {
		clawCode: string
		topicId: string
		pollingSessionId: number
	}) {
		const timerId = setTimeout(() => {
			void pollClawStatusUntilReady({
				clawCode,
				topicId,
				pollingSessionId,
			})
		}, SANDBOX_STATUS_POLL_INTERVAL_MS)

		statusPollingTimerMapRef.current.set(clawCode, timerId)
	}

	async function pollClawStatusUntilReady({
		clawCode,
		topicId,
		pollingSessionId,
	}: {
		clawCode: string
		topicId: string
		pollingSessionId: number
	}) {
		if (statusPollingSessionMapRef.current.get(clawCode) !== pollingSessionId) return

		try {
			const statusData = await MagicClawApi.getMagicClawSandboxStatus(
				{ topic_id: topicId },
				{ enableErrorMessagePrompt: false },
			)
			if (statusPollingSessionMapRef.current.get(clawCode) !== pollingSessionId) return

			const nextStatus = normalizeMagicClawStatus(statusData?.status)
			setClawStatusOverride(clawCode, nextStatus)

			if (nextStatus === MAGIC_CLAW_STATUS.PENDING) {
				scheduleClawStatusPoll({
					clawCode,
					topicId,
					pollingSessionId,
				})
				return
			}

			stopClawStatusPolling(clawCode)
			await onRefreshList()
		} catch {
			if (statusPollingSessionMapRef.current.get(clawCode) !== pollingSessionId) return

			scheduleClawStatusPoll({
				clawCode,
				topicId,
				pollingSessionId,
			})
		}
	}

	async function resolveClawTopicId(claw: MagicClawItem) {
		if (!claw.project_id) return null

		const project = await SuperMagicApi.getProjectDetail(
			{ id: claw.project_id },
			{ enableErrorMessagePrompt: false },
		)
		if (project?.current_topic_id) return project.current_topic_id

		const topics = await SuperMagicApi.getTopicsByProjectId({
			id: claw.project_id,
			page: 1,
			page_size: 1,
		})
		return topics.list?.[0]?.id ?? null
	}

	async function runClawSandboxAction({
		claw,
		successKey,
		errorKey,
		action,
	}: {
		claw: MagicClawItem
		successKey: string
		errorKey: string
		action: (params: { topic_id: string }) => Promise<unknown>
	}) {
		if (!claw.code) return

		setActiveActionClawCode(claw.code)
		try {
			const topicId = await resolveClawTopicId(claw)
			if (!topicId) throw new Error("claw-topic-not-found")

			await action({ topic_id: topicId })
			toast.success(t(successKey, clawBrandValues))
			await onRefreshList()
		} catch {
			toast.error(t(errorKey, clawBrandValues))
		} finally {
			setActiveActionClawCode(null)
		}
	}

	async function handleDeleteClaw(claw: MagicClawItem) {
		if (!claw.code) return

		try {
			stopClawStatusPolling(claw.code)
			setClawStatusOverride(claw.code)
			await MagicClawApi.deleteMagicClaw({ code: claw.code })
			toast.success(t("superLobster.created.deleteSuccess", clawBrandValues))
			await onRefreshList()
		} catch {
			toast.error(t("superLobster.created.deleteFailed", clawBrandValues))
		}
	}

	async function handleStopClaw(claw: MagicClawItem) {
		await runClawSandboxAction({
			claw,
			successKey: "superLobster.created.stopSuccess",
			errorKey: "superLobster.created.stopFailed",
			action: MagicClawApi.stopMagicClawSandbox,
		})
	}

	async function handleRestartClaw(claw: MagicClawItem) {
		if (!claw.code) return

		setRestartingClawCode(claw.code, true)
		try {
			await runClawSandboxAction({
				claw,
				successKey: "superLobster.created.restartSuccess",
				errorKey: "superLobster.created.restartFailed",
				action: MagicClawApi.restartMagicClawSandbox,
			})
		} finally {
			setRestartingClawCode(claw.code, false)
		}
	}

	async function handleUpgradeClaw(claw: MagicClawItem) {
		await runClawSandboxAction({
			claw,
			successKey: "superLobster.created.restartSuccess",
			errorKey: "superLobster.created.restartFailed",
			action: MagicClawApi.upgradeMagicClawSandbox,
		})
	}

	async function preWarmClawSandbox(claw: MagicClawItem) {
		try {
			const topicId = await resolveClawTopicId(claw)
			if (!topicId) return

			await SuperMagicApi.preWarmSandbox({
				topic_id: topicId,
			})
		} catch {
			// Ignore pre-warm failures so opening stays responsive.
		}
	}

	function handleOpenClawPlaygroundWithPreWarm(claw: MagicClawItem) {
		if (!claw.code) return

		void preWarmClawSandbox(claw)
		onOpenClawPlayground(claw.code)
	}

	async function handleStartClaw(claw: MagicClawItem) {
		if (!claw.code) return

		setActiveActionClawCode(claw.code)
		try {
			const topicId = await resolveClawTopicId(claw)
			if (!topicId) throw new Error("claw-topic-not-found")

			stopClawStatusPolling(claw.code)
			setClawStatusOverride(claw.code, MAGIC_CLAW_STATUS.PENDING)

			await MagicClawApi.startMagicClawSandbox(
				{ topic_id: topicId },
				{ enableErrorMessagePrompt: false },
			)
			void onRefreshList()

			const pollingSessionId = statusPollingSessionMapRef.current.get(claw.code) ?? 0
			void pollClawStatusUntilReady({
				clawCode: claw.code,
				topicId,
				pollingSessionId,
			})
		} catch {
			stopClawStatusPolling(claw.code)
			setClawStatusOverride(claw.code)
			toast.error(t("superLobster.created.startFailed", clawBrandValues))
		} finally {
			setActiveActionClawCode(null)
		}
	}

	return {
		activeActionClawCode,
		getDisplayedClawStatus,
		handleDeleteClaw,
		handleOpenClawPlaygroundWithPreWarm,
		handleRestartClaw,
		handleUpgradeClaw,
		handleStartClaw,
		handleStopClaw,
	}
}
