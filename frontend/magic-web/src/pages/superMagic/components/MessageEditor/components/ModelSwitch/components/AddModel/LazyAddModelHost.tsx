import { Suspense, useEffect, useMemo } from "react"
import { AddModelDialogLazy } from "./add-model-dialog-lazy"
import { AddModelStoreProvider } from "./context"
import { AddModelStore } from "./store"
import type { AddModelType } from "./store"
import type { SavedAiModel } from "./types"

export interface AddModelOpenRequest {
	modelType: AddModelType
	requestId: number
}

interface LazyAddModelHostProps {
	request: AddModelOpenRequest | null
	onModelSaved?: (model: SavedAiModel, modelType: AddModelType) => void
}

function LazyAddModelHost({ request, onModelSaved }: LazyAddModelHostProps) {
	const store = useMemo(() => new AddModelStore(), [])

	useEffect(() => {
		if (!request) return
		store.openAddModel(request.modelType)
	}, [request, store])

	return (
		<AddModelStoreProvider value={store}>
			<Suspense fallback={null}>
				<AddModelDialogLazy onModelSaved={onModelSaved} />
			</Suspense>
		</AddModelStoreProvider>
	)
}

export default LazyAddModelHost
