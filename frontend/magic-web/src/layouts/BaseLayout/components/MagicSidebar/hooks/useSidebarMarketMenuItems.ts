import { useMemo } from "react"
import { FUNCTION_PERMISSION_CODE } from "@/apis"
import { useFunctionPermission } from "@/hooks/useFunctionPermission"
import { RouteName } from "@/routes/constants"
import type { SidebarMarketMenuItem } from "@/layouts/BaseLayout/components/MagicSidebar/hooks/useSidebarMarketMenuItems.types"
import { BASE_MARKET_MENU_ITEMS } from "./baseMarketMenuItems"

export function useSidebarMarketMenuItems() {
	const { isAllowed: canAccessMagicClaw } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.MagicClawAccess,
	)

	return useMemo<SidebarMarketMenuItem[]>(() => {
		return BASE_MARKET_MENU_ITEMS.filter(
			(item) => item.routeName !== RouteName.MagiClaw || canAccessMagicClaw,
		)
	}, [canAccessMagicClaw])
}
