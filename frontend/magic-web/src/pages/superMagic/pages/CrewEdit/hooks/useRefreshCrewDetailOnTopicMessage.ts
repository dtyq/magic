import { useEffect, useRef } from "react"
import magicToast from "@/components/base/MagicToaster/utils"
import { superMagicStore } from "@/pages/superMagic/stores"
import { CREW_EDIT_ERROR } from "../constants/errors"
import type { CrewEditRootStore } from "../store/root-store"
import { resolveCrewEditError } from "../store/shared"

interface UseRefreshCrewDetailOnTopicMessageParams {
	store: CrewEditRootStore
}

const REFRESH_CREW_DETAIL_TOOL_NAMES = new Set(["update_agent", "update_skill"])

function resolveCrewCodeFromToolDetail(detail: unknown): string | null {
	if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null
	const detailRecord = detail as Record<string, unknown>
	const candidates = [
		detailRecord,
		detailRecord.data,
		detailRecord.result,
		(detailRecord.result as Record<string, unknown> | null | undefined)?.data,
	]
	for (const candidate of candidates) {
		if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue
		const code = (candidate as Record<string, unknown>).code
		if (typeof code === "string" && code) return code
	}
	return null
}

export function useRefreshCrewDetailOnTopicMessage({
	store,
}: UseRefreshCrewDetailOnTopicMessageParams): void {
	const refreshTaskRef = useRef<null | Promise<void>>(null)

	useEffect(() => {
		if (!store.crewCode) return

		const unregister = superMagicStore.subscribe("toolCall.settled", ({ payload }) => {
			const isRefreshTool = Boolean(
				payload.toolCall.name && REFRESH_CREW_DETAIL_TOOL_NAMES.has(payload.toolCall.name),
			)
			if (payload.strength !== "strong" || !isRefreshTool) return

			if (payload.response.status === "error" || payload.response.status === "suspended") {
				magicToast.error(payload.response.remark || "员工信息更新失败")
				return
			}
			if (payload.response.status !== "finished") return

			const crewCode = resolveCrewCodeFromToolDetail(payload.response.detail)
			if (crewCode && crewCode !== store.crewCode) return

			if (refreshTaskRef.current) return

			refreshTaskRef.current = store
				.refreshAgentDetail()
				.then(
					() => {
						magicToast.success("员工信息更新成功")
					},
					(error) => {
						const { message } = resolveCrewEditError({
							error,
							fallbackKey: CREW_EDIT_ERROR.loadAgentFailed,
						})
						magicToast.error(message)
					},
				)
				.finally(() => {
					refreshTaskRef.current = null
				})
		})

		return unregister
	}, [store, store.crewCode])
}
