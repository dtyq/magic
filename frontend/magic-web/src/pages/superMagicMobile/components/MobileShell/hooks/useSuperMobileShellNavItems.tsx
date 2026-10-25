import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { FUNCTION_PERMISSION_CODE } from "@/apis/modules/function-permission"
import { useFunctionPermission } from "@/hooks/useFunctionPermission"
import { hasOrganizationAppsShortcuts } from "@/layouts/BaseLayoutMobile/components/MobileTabBar/constants/tabsConfig.shared"
import { userStore } from "@/models/user"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { isMicroAppEnabled } from "@/services/microAppFeature"
import { isPersonaResearchEnabled } from "@/services/personaResearchFeature"
import { isPrivateDeployment } from "@/utils/env"

import { BASE_SUPER_MOBILE_SHELL_NAV_ITEMS } from "./baseSuperMobileShellNavItems"
import type { SuperMobileShellResolvedNavItem } from "./types"

/** Resolves default shell nav config into UI-ready items while keeping this as the smallest overlay point. */
export function useSuperMobileShellNavItems(): SuperMobileShellResolvedNavItem[] {
	const { t } = useTranslation("super")
	const { isAllowed: canAccessMagicClaw, isLoading: isMagicClawAccessLoading } =
		useFunctionPermission(FUNCTION_PERMISSION_CODE.MagicClawAccess)
	const isPrivateDeploymentEnv = isPrivateDeployment()
	const microAppEnabled = isMicroAppEnabled()
	const personaResearchEnabled = isPersonaResearchEnabled()
	const clawBrandValues = getClawBrandTranslationValues()
	const shouldShowAppsEntry = hasOrganizationAppsShortcuts({
		isPersonalOrganization: userStore.user.isPersonalOrganization,
	})

	return useMemo<SuperMobileShellResolvedNavItem[]>(() => {
		return BASE_SUPER_MOBILE_SHELL_NAV_ITEMS.filter((item) => {
			if (item.key === "apps" && !shouldShowAppsEntry) return false
			if (item.key === "recording" && isPrivateDeploymentEnv) return false
			if (item.key === "microApps" && !microAppEnabled) return false
			if (item.key === "personaResearch" && !personaResearchEnabled) return false
			if (item.requiredPermissionCode === FUNCTION_PERMISSION_CODE.MagicClawAccess) {
				// Keep permission-gated entries fail-closed while loading to match desktop and legacy mobile entry policy.
				return !isMagicClawAccessLoading && canAccessMagicClaw
			}
			return true
		}).map(({ labelKey, ...item }) => ({
			...item,
			// Config-driven overlay items need variable label keys; keep keys static in config modules.
			label: item.key === "magiClaw" ? t(labelKey, clawBrandValues) : t(labelKey),
		}))
	}, [
		canAccessMagicClaw,
		isMagicClawAccessLoading,
		isPrivateDeploymentEnv,
		microAppEnabled,
		personaResearchEnabled,
		shouldShowAppsEntry,
		clawBrandValues,
		t,
	])
}
