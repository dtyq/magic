import { memo } from "react"
import Container from "../../components/MainInputContainer"
import Header from "./components/Header"
import { useFeaturedModeListRefreshOnAgentsPageMount } from "@/pages/superMagic/hooks/useFeaturedModeListRefresh"

function AgentsPage() {
	useFeaturedModeListRefreshOnAgentsPageMount()

	return (
		<div className="flex flex-1 flex-col items-center overflow-hidden rounded-xl border border-border bg-background">
			<Header className="shrink-0" />
			<Container />
		</div>
	)
}

export default memo(AgentsPage)
