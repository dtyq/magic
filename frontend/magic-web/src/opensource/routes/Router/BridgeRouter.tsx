import { PropsWithChildren, useContext } from "react"
import { BrowserRouter } from "./BrowserRouter"
import { UNSAFE_RouteContext, matchRoutes, UNSAFE_LocationContext } from "react-router"
import { RouteMatch, RouteObject } from "react-router/dist/lib/context"
import { getRoutes } from "@/opensource/routes"

interface BridgeRouterProps {
	routes: Array<RouteObject>
}

/**
 * @description Bridge routing context, used for dynamically mounting non root node routing context acquisition
 * @param props
 * @constructor
 */
function BaseBridgeRouter(props: PropsWithChildren<BridgeRouterProps>) {
	const { location } = useContext(UNSAFE_LocationContext)
	const matches: Array<RouteMatch> = matchRoutes(props.routes, location) || []
	return (
		<UNSAFE_RouteContext.Provider
			value={{
				outlet: null,
				isDataRoute: false,
				matches: matches,
			}}
		>
			{props?.children}
		</UNSAFE_RouteContext.Provider>
	)
}

export function BridgeRouter(props: PropsWithChildren) {
	const routes = getRoutes()
	return (
		<BrowserRouter>
			<BaseBridgeRouter {...props} routes={routes} />
		</BrowserRouter>
	)
}
