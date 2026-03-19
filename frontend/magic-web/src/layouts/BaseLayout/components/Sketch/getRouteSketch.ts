import { RouteName } from "@/routes/constants"
import { logger as Logger } from "@/utils/log"
import { routeSketchMap } from "./routeSketchMap"

export type RouteSketchMap = Partial<
	Record<
		RouteName,
		{
			desktop?: React.LazyExoticComponent<() => JSX.Element>
			mobile?: React.LazyExoticComponent<() => JSX.Element>
		}
	>
>

const logger = Logger.createLogger("RouteSketchMap")
const noSupportRouteSketchMap = new Set<RouteName>()

/**
 * Get the sketch component for a specific route and device type
 * @param routeName - The route name to get sketch for
 * @param deviceType - The device type ('mobile' or 'desktop')
 * @returns The lazy-loaded sketch component or undefined if not found
 */
export function getRouteSketch(
	routeName: RouteName | undefined,
	deviceType: "mobile" | "desktop",
): React.LazyExoticComponent<() => JSX.Element> | undefined {
	if (!routeName) return undefined
	const sketch = routeSketchMap[routeName]?.[deviceType]
	// 如果当前路由没有支持的骨架屏，则上报一次
	if (!sketch && !noSupportRouteSketchMap.has(routeName)) {
		noSupportRouteSketchMap.add(routeName)
		logger.report("no support route sketch", {
			routeName,
			deviceType,
		})
	}
	return sketch || undefined
}
