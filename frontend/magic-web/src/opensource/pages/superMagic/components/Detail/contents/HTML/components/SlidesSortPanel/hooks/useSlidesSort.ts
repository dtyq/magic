import { useState, useCallback, useMemo } from "react"
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core"
import {
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
	arrayMove,
} from "@dnd-kit/sortable"
import type { SortableSlide } from "../types"

/**
 * Hook for managing slides sorting logic
 */
export function useSlidesSort(initialSlides: SortableSlide[]) {
	const [items, setItems] = useState<SortableSlide[]>(initialSlides)

	// Configure sensors for drag and drop
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8, // Require 8px movement to start dragging
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	)

	// Check if order has changed
	const hasChanges = useMemo(() => {
		if (items.length !== initialSlides.length) return true
		return items.some((item, index) => item.id !== initialSlides[index].id)
	}, [items, initialSlides])

	// Handle drag end event
	const handleDragEnd = useCallback((event: DragEndEvent) => {
		const { active, over } = event

		if (over && active.id !== over.id) {
			setItems((items) => {
				const oldIndex = items.findIndex((item) => item.id === active.id)
				const newIndex = items.findIndex((item) => item.id === over.id)

				return arrayMove(items, oldIndex, newIndex)
			})
		}
	}, [])

	// Reset to original order
	const resetItems = useCallback(() => {
		setItems(initialSlides)
	}, [initialSlides])

	// Get sorted paths array
	const getSortedPaths = useCallback(() => {
		return items.map((item) => item.path)
	}, [items])

	return {
		items,
		sensors,
		handleDragEnd,
		getSortedPaths,
		resetItems,
		hasChanges,
		DndContext,
		SortableContext,
		closestCenter,
		verticalListSortingStrategy,
	}
}
