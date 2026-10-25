import { useEffect, useMemo, type Dispatch, type SetStateAction } from "react"
import { useMemoizedFn } from "ahooks"
import type { FileManagerLocationState } from "../components/FileManager/types"

interface Modifiers {
	shiftKey: boolean
	metaKey: boolean
	ctrlKey: boolean
}

export function useFileManagerSelection({
	ids,
	location,
	setLocation,
	ready,
	checked,
}: {
	ids: string[]
	location: FileManagerLocationState
	setLocation: Dispatch<SetStateAction<FileManagerLocationState>>
	ready: boolean
	checked?: {
		ids: ReadonlySet<string>
		onChange: (addedIds: string[], removedIds: string[]) => void
	}
}) {
	const positions = useMemo(() => new Map(ids.map((id, index) => [id, index])), [ids])
	const checking = Boolean(checked)
	const checkedIds = checked?.ids
	const selectedIds = useMemo(
		() => (checkedIds ? new Set(checkedIds) : location.selectedIds),
		[checkedIds, location.selectedIds],
	)
	const select = useMemoizedFn((id: string, modifiers: Modifiers, focusOnly = false) => {
		setLocation((current) => {
			// 勾选模式中，点名称和移动焦点不改变清单；只有 checkbox／Space 改变勾选。
			if (checked) return { ...current, focusedId: id, anchorId: id }
			const additive = modifiers.metaKey || modifiers.ctrlKey
			let selectedIds = new Set(additive ? current.selectedIds : [])
			if (focusOnly) selectedIds = current.selectedIds
			else if (modifiers.shiftKey && current.anchorId && positions.has(current.anchorId)) {
				const start = positions.get(current.anchorId) ?? 0
				const end = positions.get(id) ?? start
				for (let index = Math.min(start, end); index <= Math.max(start, end); index++)
					selectedIds.add(ids[index])
			} else if (additive && selectedIds.has(id)) selectedIds.delete(id)
			else selectedIds.add(id)
			return {
				...current,
				selectedIds,
				focusedId: id,
				anchorId: modifiers.shiftKey ? (current.anchorId ?? id) : id,
			}
		})
	})
	const replace = useMemoizedFn((selectedIds: Set<string>) => {
		setLocation((current) => ({
			...current,
			selectedIds,
			focusedId: selectedIds.values().next().value ?? null,
		}))
	})
	// 加载期间或错误时保留选择；只有成功取得目录内容后才移除消失的 ID。
	useEffect(() => {
		if (!ready) return
		setLocation((current) => {
			const selectedIds = checking
				? current.selectedIds
				: new Set([...current.selectedIds].filter((id) => positions.has(id)))
			const focusedId =
				current.focusedId && positions.has(current.focusedId) ? current.focusedId : null
			if (selectedIds.size === current.selectedIds.size && focusedId === current.focusedId)
				return current
			return { ...current, selectedIds, focusedId }
		})
	}, [positions, ready, setLocation, checking])
	const toggle = useMemoizedFn((id: string) => {
		if (!checked) return
		const removing = checked.ids.has(id)
		checked.onChange(removing ? [] : [id], removing ? [id] : [])
		setLocation((current) => ({ ...current, focusedId: id, anchorId: id }))
	})
	return {
		selectedIds,
		focusedId: location.focusedId,
		positions,
		select,
		replace,
		toggle,
		clear: () =>
			setLocation((current) => ({
				...current,
				selectedIds: new Set(),
				focusedId: null,
				anchorId: null,
			})),
		all: () =>
			checked
				? checked.onChange(
						ids.filter((id) => !checked.ids.has(id)),
						[],
					)
				: replace(new Set(ids)),
	}
}
