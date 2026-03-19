import { Fragment } from "react/jsx-runtime"
import LayersDrawer from "./components/LayersDrawer"
import LayersButton from "./components/LayersButton"
import LayersResizeDragHandle from "./components/LayersResizeDragHandle"

export default function Layers() {
	return (
		<Fragment>
			<LayersButton />
			<LayersDrawer />
			<LayersResizeDragHandle />
		</Fragment>
	)
}
