import { useMemo } from "react"
import { FUNCTION_PERMISSION_CODE } from "@/apis"
import { useFunctionPermission } from "@/hooks/useFunctionPermission"
import { RouteName } from "@/routes/constants"
import type { SidebarMarketMenuItem } from "@/layouts/BaseLayout/components/MagicSidebar/hooks/useSidebarMarketMenuItems.types"
import { isPersonaResearchEnabled } from "@/services/personaResearchFeature"
import { BASE_MARKET_MENU_ITEMS } from "./baseMarketMenuItems"

export function useSidebarMarketMenuItems() {
	const { isAllowed: canAccessMagicClaw } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.MagicClawAccess,
	)

	return useMemo<SidebarMarketMenuItem[]>(() => {
		const personaResearchEnabled = isPersonaResearchEnabled()
		return BASE_MARKET_MENU_ITEMS.filter((item) => {
			if (item.routeName === RouteName.MagiClaw) return canAccessMagicClaw
			if (item.routeName === RouteName.PersonaResearch) return personaResearchEnabled
			return true
		})
	}, [canAccessMagicClaw])
}
