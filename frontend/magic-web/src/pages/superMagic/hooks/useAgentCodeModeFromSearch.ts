import { useEffect, useRef } from "react"
import { useLocation } from "react-router"
import { TopicMode } from "../pages/Workspace/TopicMode"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { crewService } from "@/services/crew/CrewService"

interface UseAgentCodeModeFromSearchOptions {
	currentMode?: string | null
	enabled?: boolean
	onModeResolved: (mode: TopicMode) => void
	onAgentCodeCleared?: () => void
	clearAgentCodeFromUrl?: boolean
}

function useAgentCodeModeFromSearch({
	currentMode,
	enabled = true,
	onModeResolved,
	onAgentCodeCleared,
	clearAgentCodeFromUrl = false,
}: UseAgentCodeModeFromSearchOptions) {
	const location = useLocation()
	const consumedAgentCodeRef = useRef<string | null>(null)
	const pendingAgentCodeRef = useRef<string | null>(null)
	const requestGenerationRef = useRef(0)

	useEffect(() => {
		if (!enabled) {
			requestGenerationRef.current += 1
			return
		}

		/** Removes a consumed or failed deep-link parameter without changing other query state. */
		function clearAgentCodeQueryParam(force = false) {
			if (!force && !clearAgentCodeFromUrl) return

			const searchParams = new URLSearchParams(location.search)
			if (!searchParams.has("agentCode")) return

			searchParams.delete("agentCode")
			const nextSearch = searchParams.toString()
			const nextUrl = `${location.pathname}${nextSearch ? `?${nextSearch}` : ""}${location.hash || ""}`

			window.history.replaceState(window.history.state, "", nextUrl)
		}

		const agentCode = new URLSearchParams(location.search).get("agentCode")?.trim() || null
		if (!agentCode) {
			requestGenerationRef.current += 1
			consumedAgentCodeRef.current = null
			pendingAgentCodeRef.current = null
			onAgentCodeCleared?.()
			return
		}
		if (consumedAgentCodeRef.current === agentCode) return
		if (pendingAgentCodeRef.current === agentCode) return

		pendingAgentCodeRef.current = agentCode
		const requestGeneration = ++requestGenerationRef.current

		// Resolve access before reading modeList so a share link can hire an authorized employee.
		void (async () => {
			try {
				const resolution = await crewService.resolveAgentAccess(agentCode, {
					autoHire: true,
				})
				if (requestGeneration !== requestGenerationRef.current) return

				if (resolution.status !== "ready") {
					pendingAgentCodeRef.current = null
					clearAgentCodeQueryParam(true)
					onAgentCodeCleared?.()
					return
				}

				const nextModeList = await superMagicModeService.fetchModeList({
					force: resolution.hired,
				})
				if (requestGeneration !== requestGenerationRef.current) return

				const targetMode = nextModeList.find(
					(item) => item.mode.identifier === resolution.code,
				)?.mode.identifier
				if (!targetMode) {
					pendingAgentCodeRef.current = null
					clearAgentCodeQueryParam(true)
					onAgentCodeCleared?.()
					return
				}

				if (currentMode === targetMode) {
					consumedAgentCodeRef.current = agentCode
					pendingAgentCodeRef.current = null
					clearAgentCodeQueryParam()
					return
				}

				consumedAgentCodeRef.current = agentCode
				pendingAgentCodeRef.current = null
				onModeResolved(targetMode as TopicMode)
			} catch {
				if (requestGeneration !== requestGenerationRef.current) return
				pendingAgentCodeRef.current = null
				clearAgentCodeQueryParam(true)
				onAgentCodeCleared?.()
			}
		})()
	}, [
		clearAgentCodeFromUrl,
		currentMode,
		enabled,
		location.hash,
		location.pathname,
		location.search,
		onAgentCodeCleared,
		onModeResolved,
	])
}

export default useAgentCodeModeFromSearch
