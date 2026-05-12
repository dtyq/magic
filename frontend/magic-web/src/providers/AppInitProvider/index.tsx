import { type PropsWithChildren } from "react"
import { appStore } from "@/stores/app"
import { observer } from "mobx-react-lite"
import BaseLayoutSketch from "@/layouts/BaseLayout/components/Sketch"
import { RouteName } from "@/routes/constants"
import { routesMatch } from "@/routes/history/helpers"

function shouldRenderChildrenDuringInit(pathname: string) {
	const routeName = routesMatch(pathname)?.route.name
	return routeName === RouteName.Login || routeName === RouteName.Invite
}

/**
 * Internal initialization component
 */
const AppInitProvider = observer(({ children }: PropsWithChildren) => {
	const { isInitialing } = appStore

	if (isInitialing) {
		if (shouldRenderChildrenDuringInit(window.location.pathname)) {
			return children
		}

		return <BaseLayoutSketch />
	}

	return children
})

export default AppInitProvider
