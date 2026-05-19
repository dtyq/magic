import { useEffect } from "react"
import statusPollingService from "@/pages/superMagic/services/statusPollingService"

function useResourceStatusPolling() {
	useEffect(() => statusPollingService.subscribeResourceStatusPolling(), [])
}

export default useResourceStatusPolling
