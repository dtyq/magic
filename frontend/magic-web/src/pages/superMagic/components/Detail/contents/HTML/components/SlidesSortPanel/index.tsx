import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { message } from "antd"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Separator } from "@/components/shadcn-ui/separator"
import { SortableSlideItem } from "./SortableSlideItem"
import { useSlidesSort } from "./hooks/useSlidesSort"
import { useSlideScreenshots } from "./hooks/useSlideScreenshots"
import { findMagicProjectJsFile, updateSlidesOrder } from "../../utils/magicProjectUpdater"
import type { SlidesSortPanelProps, SortableSlide } from "./types"
import { Loader2 } from "lucide-react"

/**
 * Slides sort panel component
 */
export function SlidesSortPanel({
	slides,
	originalSlidesPaths,
	filePathMapping,
	attachments,
	currentFileId,
	currentFileName,
	onSave,
	onCancel,
	slideContents,
}: SlidesSortPanelProps) {
	const { t } = useTranslation("super")
	const [isSaving, setIsSaving] = useState(false)

	// Convert slides to sortable items with HTML content
	const sortableSlides = useMemo<SortableSlide[]>(() => {
		return slides.map((slideUrl, index) => {
			const originalPath = originalSlidesPaths[index] || ""
			const content = slideContents?.get(index)

			return {
				id: `slide-${index}`,
				path: originalPath,
				url: slideUrl,
				content,
				index,
			}
		})
	}, [slides, originalSlidesPaths, slideContents])

	// Generate screenshots for thumbnails using snapDOM
	const { getScreenshot } = useSlideScreenshots({
		slides: sortableSlides,
		enabled: true,
	})

	// Use slides sort hook
	const {
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
	} = useSlidesSort(sortableSlides)

	// Handle save button click
	const handleSave = async () => {
		setIsSaving(true)

		try {
			// Find magic.project.js file
			const magicProjectFile = await findMagicProjectJsFile({
				attachments,
				currentFileId,
				currentFileName,
			})

			if (!magicProjectFile) {
				message.error(t("fileViewer.sortSlidesFailed"))
				return
			}

			// Get sorted paths
			const newSlidesOrder = getSortedPaths()

			// Get sorted URLs for optimistic update
			const newSlidesUrls = items.map((item) => item.url)

			// Update slides order in magic.project.js
			await updateSlidesOrder({
				fileId: magicProjectFile.fileId,
				newSlidesOrder,
			})

			message.success(t("fileViewer.sortSlidesSuccess"))
			// Pass new sorted URLs to parent for optimistic update
			onSave(newSlidesUrls)
		} catch (error) {
			console.error("Failed to save slides order:", error)
			message.error(t("fileViewer.sortSlidesFailed"))
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<div className="flex h-[50vh] w-full max-w-[380px] flex-col">
			{/* Header */}
			<div className="shrink-0 px-3 py-2.5">
				<h3 className="text-sm font-semibold text-foreground">
					{t("fileViewer.sortSlidesTitle")}
				</h3>
			</div>

			<Separator className="shrink-0" />

			{/* Slides list with scrollable area */}
			<ScrollArea className="min-h-0 flex-1">
				<div className="space-y-1.5 p-3">
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={handleDragEnd}
					>
						<SortableContext
							items={items.map((item) => item.id)}
							strategy={verticalListSortingStrategy}
						>
							{items.map((slide, index) => (
								<SortableSlideItem
									key={slide.id}
									slide={slide}
									index={index}
									screenshot={getScreenshot(slide.index)}
								/>
							))}
						</SortableContext>
					</DndContext>
				</div>
			</ScrollArea>

			<Separator className="shrink-0" />

			{/* Actions - Fixed at bottom */}
			<div className="flex shrink-0 items-center justify-end gap-2 px-3 py-2.5">
				{hasChanges && (
					<Button
						variant="outline"
						size="sm"
						className="mr-auto"
						onClick={resetItems}
						disabled={isSaving}
					>
						{t("fileViewer.sortSlidesReset")}
					</Button>
				)}

				<Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
					{t("fileViewer.sortSlidesCancel")}
				</Button>

				<Button size="sm" onClick={handleSave} disabled={isSaving || !hasChanges}>
					{isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
					{isSaving ? t("common.saving") : t("fileViewer.sortSlidesSave")}
				</Button>
			</div>
		</div>
	)
}
