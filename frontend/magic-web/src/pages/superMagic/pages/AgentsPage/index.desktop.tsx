import { memo, useEffect } from "react"
import Container from "../../components/MainInputContainer"
import Header from "./components/Header"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"

function AgentsPage() {
	// Refresh crew list each time the home page is visited
	useEffect(() => {
		superMagicModeService.fetchModeList()
	}, [])

	return (
		<div className="flex flex-1 flex-col items-center overflow-hidden rounded-xl border border-border bg-background">
			<Header className="shrink-0" />
			<Container />
		</div>
	)
}

export default memo(AgentsPage)
