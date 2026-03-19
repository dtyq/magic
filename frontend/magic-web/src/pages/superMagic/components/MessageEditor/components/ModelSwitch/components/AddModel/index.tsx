import { useMemo } from "react"
import { observer } from "mobx-react-lite"
import { AddModelStore } from "./store"
import { AddModelStoreProvider } from "./context"
import AddModelDialog from "./AddModelDialog"

export { useAddModelStore } from "./context"
export { AddModelStore } from "./store"

function AddModelProvider({ children }: { children: React.ReactNode }) {
	const store = useMemo(() => new AddModelStore(), [])

	return (
		<AddModelStoreProvider value={store}>
			{children}
			<AddModelDialog />
		</AddModelStoreProvider>
	)
}

export default observer(AddModelProvider)
