import { type PropsWithChildren } from "react"
import { appStore } from "@/opensource/stores/app"
import { observer } from "mobx-react-lite"
import BaseLayoutSketch from "@/opensource/layouts/BaseLayout/components/Sketch"

/**
 * Internal initialization component
 */
const AppInitProvider = observer(({ children }: PropsWithChildren) => {
	const { isInitialing } = appStore

	if (isInitialing) {
		return <BaseLayoutSketch />
	}

	return children
})

export default AppInitProvider
