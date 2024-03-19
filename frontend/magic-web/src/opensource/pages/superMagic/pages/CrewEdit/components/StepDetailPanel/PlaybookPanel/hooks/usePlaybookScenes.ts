import { useEffect, useState } from "react"
import { useCrewEditStore } from "../../../../context"
import type { SceneAction, SceneItem } from "../types"

export interface UsePlaybookScenesReturn {
	isLoading: boolean
	error: string | null
	filteredScenes: SceneItem[]
	selectedIds: Set<string>
	searchValue: string
	filterValue: string
	allSelected: boolean
	someSelected: boolean
	setSearchValue: (value: string) => void
	setFilterValue: (value: string) => void
	handleSelectAll: (checked: boolean) => void
	handleSelectOne: (id: string, checked: boolean) => void
	handleToggleEnabled: (id: string) => void
	handleAction: (id: string, action: SceneAction) => void
	handleReset: () => void
	handleReorder: (activeId: string, overId: string) => void
	handleCancelSelection: () => void
	handleBatchDelete: (ids: string[]) => Promise<void>
}

export function usePlaybookScenes(): UsePlaybookScenesReturn {
	const store = useCrewEditStore()
	const { playbook } = store

	// Pure UI state — not persisted in the store
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [searchValue, setSearchValue] = useState("")
	const [filterValue, setFilterValue] = useState("all")

	useEffect(() => {
		void playbook.fetchScenes()
	}, [playbook])

	// Computed inline — reactive because PlaybookPanel is wrapped with observer
	const filteredScenes = playbook.scenes.filter((scene) => {
		const search = searchValue.trim().toLowerCase()
		const sceneName = toSearchText(scene.name)
		const sceneDescription = toSearchText(scene.description)
		const matchesSearch =
			!search ||
			sceneName.toLowerCase().includes(search) ||
			sceneDescription.toLowerCase().includes(search)
		const matchesFilter =
			filterValue === "all" ||
			(filterValue === "enabled" && scene.enabled) ||
			(filterValue === "disabled" && !scene.enabled)
		return matchesSearch && matchesFilter
	})

	// Selection state is scoped to filteredScenes, not the full list
	const allSelected =
		filteredScenes.length > 0 && filteredScenes.every((s) => selectedIds.has(s.id))
	const someSelected = !allSelected && filteredScenes.some((s) => selectedIds.has(s.id))

	function handleSelectAll(checked: boolean) {
		setSelectedIds((prev) => {
			const next = new Set(prev)
			if (checked) filteredScenes.forEach((s) => next.add(s.id))
			else filteredScenes.forEach((s) => next.delete(s.id))
			return next
		})
	}

	function handleSelectOne(id: string, checked: boolean) {
		setSelectedIds((prev) => {
			const next = new Set(prev)
			if (checked) next.add(id)
			else next.delete(id)
			return next
		})
	}

	function handleToggleEnabled(id: string) {
		void playbook.toggleSceneEnabled(id)
	}

	function handleAction(id: string, action: SceneAction) {
		if (action === "delete") {
			void playbook.deleteScene(id)
			setSelectedIds((prev) => {
				const next = new Set(prev)
				next.delete(id)
				return next
			})
		}
		// "edit" is handled by the parent via navigation/modal — no store mutation needed here
	}

	function handleReset() {
		setSearchValue("")
		setFilterValue("all")
		setSelectedIds(new Set())
	}

	function handleCancelSelection() {
		setSelectedIds(new Set())
	}

	async function handleBatchDelete(ids: string[]) {
		await Promise.all(ids.map((id) => playbook.deleteScene(id)))
		setSelectedIds(new Set())
	}

	function handleReorder(activeId: string, overId: string) {
		void playbook.reorderScenes(activeId, overId)
	}

	return {
		isLoading: playbook.scenesLoading,
		error: playbook.scenesError,
		filteredScenes,
		selectedIds,
		searchValue,
		filterValue,
		allSelected,
		someSelected,
		setSearchValue,
		setFilterValue,
		handleSelectAll,
		handleSelectOne,
		handleToggleEnabled,
		handleAction,
		handleReset,
		handleReorder,
		handleCancelSelection,
		handleBatchDelete,
	}
}

function toSearchText(text: SceneItem["name"]): string {
	if (typeof text === "string") return text
	return Object.values(text).join(" ")
}
