import { useEffect, useRef } from "react"
import { useLocation } from "react-router"
import { TopicMode } from "../pages/Workspace/TopicMode"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"

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
	const modeList = superMagicModeService.modeList
	const consumedAgentCodeRef = useRef<string | null>(null)
	const pendingAgentCodeRef = useRef<string | null>(null)

	function clearAgentCodeQueryParam() {
		if (!clearAgentCodeFromUrl) return

		const searchParams = new URLSearchParams(location.search)
		if (!searchParams.has("agentCode")) return

		searchParams.delete("agentCode")
		const nextSearch = searchParams.toString()
		const nextUrl = `${location.pathname}${nextSearch ? `?${nextSearch}` : ""}${location.hash || ""}`

		window.history.replaceState(window.history.state, "", nextUrl)
	}

	useEffect(() => {
		if (!enabled) return

		const agentCode = new URLSearchParams(location.search).get("agentCode")?.trim() || null
		if (!agentCode) {
			consumedAgentCodeRef.current = null
			pendingAgentCodeRef.current = null
			onAgentCodeCleared?.()
			return
		}
		if (consumedAgentCodeRef.current === agentCode) return
		if (modeList.length === 0) return

		const targetMode = modeList.find((item) => item.mode.identifier === agentCode)?.mode
			?.identifier
		if (!targetMode && superMagicModeService.fetchPromise) return
		if (!targetMode) {
			pendingAgentCodeRef.current = null
			clearAgentCodeQueryParam()
			return
		}

		if (currentMode === targetMode) {
			consumedAgentCodeRef.current = agentCode
			pendingAgentCodeRef.current = null
			clearAgentCodeQueryParam()
			return
		}

		if (pendingAgentCodeRef.current === agentCode) return

		pendingAgentCodeRef.current = agentCode
		onModeResolved(targetMode as TopicMode)
	}, [
		clearAgentCodeFromUrl,
		currentMode,
		enabled,
		location.hash,
		location.pathname,
		location.search,
		modeList,
		onAgentCodeCleared,
		onModeResolved,
	])
}

export default useAgentCodeModeFromSearch
