import { Suspense, useMemo } from "react"
import { observer } from "mobx-react-lite"
import { AddModelStore } from "./store"
import { AddModelStoreProvider } from "./context"
import { AddModelDialogLazy } from "./add-model-dialog-lazy"

export { useAddModelStore } from "./context"
export { AddModelStore } from "./store"

function AddModelProvider({ children }: { children: React.ReactNode }) {
	const store = useMemo(() => new AddModelStore(), [])

	return (
		<AddModelStoreProvider value={store}>
			{children}
			<Suspense fallback={null}>
				<AddModelDialogLazy />
			</Suspense>
		</AddModelStoreProvider>
	)
}

export default observer(AddModelProvider)
