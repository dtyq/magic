import { create } from "zustand"
import { immer } from "zustand/middleware/immer"

interface MagicSearchState {
	open: boolean
	searchWord: string
}

interface MagicSearchAction {
	closePanel: () => void
	openPanel: () => void
	setPanel: (open: boolean) => void
}

type MagicSearchStore = MagicSearchState & MagicSearchAction

export const useMagicSearchStore = create<MagicSearchStore>()(
	immer<MagicSearchStore>((set) => {
		return {
			open: false,
			searchWord: "",
			closePanel() {
				set((preState) => {
					preState.open = false
				})
			},
			openPanel() {
				set((preState) => {
					preState.open = true
				})
			},
			setPanel(open: boolean) {
				set((preState) => {
					preState.open = open
				})
			},
		}
	}),
)
