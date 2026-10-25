import { useMemoizedFn } from "ahooks"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useNavigate } from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"

/**
 * The header back arrow of the research pages. On phones it follows history, so a study opened
 * from the "all studies" list, the persona library or a chat link returns to where it was opened
 * (a fixed target sent users to the research home from everywhere); with no usable history it
 * falls back to the research home. Desktop keeps the labelled "back to my studies" target.
 */
export function useResearchBack() {
	const isMobile = useIsMobile()
	const navigate = useNavigate({ fallbackRoute: { name: RouteName.PersonaResearch } })

	return useMemoizedFn(() => {
		if (isMobile) navigate({ delta: -1, viewTransition: false })
		else navigate({ name: RouteName.PersonaResearch })
	})
}
