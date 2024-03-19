import { MagicSpin } from "@/opensource/components/base"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { useTranslation } from "react-i18next"
import { Suspense, useRef } from "react"
import { routesMatch } from "@/opensource/routes/history/helpers"
import { baseHistory } from "@/opensource/routes/history"
import { getRouteSketch } from "./getRouteSketch"
import { RouteName } from "@/opensource/routes/constants"

function SketchWithoutLayout() {
	const isMobile = useIsMobile()
	const { t } = useTranslation("interface")

	const currentRouteName = useRef(routesMatch(baseHistory.location.pathname)?.route.name)

	const CurrentRouteSketch = getRouteSketch(
		currentRouteName.current as RouteName | undefined,
		isMobile ? "mobile" : "desktop",
	)

	if (!CurrentRouteSketch) {
		return (
			<MagicSpin spinning tip={t("spin.loadingConfig")}>
				<div className="h-screen" />
			</MagicSpin>
		)
	}

	return (
		<Suspense fallback={null}>
			<CurrentRouteSketch />
		</Suspense>
	)
}

export default SketchWithoutLayout
