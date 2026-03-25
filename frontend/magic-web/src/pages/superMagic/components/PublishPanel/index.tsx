import { observer } from "mobx-react-lite"
import { PublishPanelStoreProvider, usePublishPanelStore } from "./context"
import type { PublishPanelStore } from "./store"
import PublishCreateView from "./components/PublishCreateView"
import PublishDetailView from "./components/PublishDetailView"
import PublishHistoryView from "./components/PublishHistoryView"

interface PublishPanelProps {
	store: PublishPanelStore
	onClose: () => void
	onCreateNewVersion?: () => Promise<void> | void
}

function PublishPanelContent({
	onClose,
	onCreateNewVersion,
}: {
	onClose: () => void
	onCreateNewVersion?: () => Promise<void> | void
}) {
	const store = usePublishPanelStore()

	if (store.view === "create") {
		return <PublishCreateView onClose={onClose} />
	}

	if (store.view === "detail") {
		return <PublishDetailView onClose={onClose} />
	}

	return <PublishHistoryView onClose={onClose} onCreateNewVersion={onCreateNewVersion} />
}

const PublishPanelContentObserver = observer(PublishPanelContent)

function PublishPanel({ store, onClose, onCreateNewVersion }: PublishPanelProps) {
	return (
		<PublishPanelStoreProvider store={store}>
			<PublishPanelContentObserver
				onClose={onClose}
				onCreateNewVersion={onCreateNewVersion}
			/>
		</PublishPanelStoreProvider>
	)
}

export default PublishPanel
export type {
	PublishDraft,
	PublishHistoryRecord,
	PublishInternalTarget,
	PublishPanelData,
	PublishRecordStatus,
	PublishReviewProgress,
	PublishTarget,
	PublishTo,
} from "./types"
export { PublishPanelStore } from "./store"
