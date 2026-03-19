import { useMemoizedFn, useMount } from "ahooks"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	findMagicProjectJsFile,
	updateSlidesOrder,
	insertSlide,
	deleteSlide,
	renameSlide,
} from "../../../contents/HTML/utils/magicProjectUpdater"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import type { SlideItem } from "../PPTSidebar/types"
import type { PPTStore } from "../stores/PPTStore"
import MagicModal from "@/components/base/MagicModal"
import { IconAlertTriangleFilled } from "@tabler/icons-react"
import { SuperMagicApi } from "@/apis"
import { addFileToCurrentChat, addFileToNewChat } from "@/pages/superMagic/utils/topics"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { workspaceStore, projectStore } from "@/pages/superMagic/stores/core"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import projectFilesStore from "@/stores/projectFiles"
import { MentionItemType } from "@/components/business/MentionPanel/types"

interface UsePPTSidebarOptions {
	slides: SlideItem[]
	activeIndex: number
	isTransitioning: boolean
	allowEdit: boolean
	attachments?: unknown[]
	attachmentList?: any[]
	mainFileId?: string
	mainFileName?: string
	projectId?: string
	parentId?: string
	setActiveIndex: (index: number) => void | Promise<void>
	setIsTransitioning: (isTransitioning: boolean) => void
	onSortSave?: (newSlidesPaths: string[]) => void
	store: PPTStore
	isAnySlideEditing?: boolean
}

export function usePPTSidebar({
	slides,
	activeIndex,
	isTransitioning,
	allowEdit,
	attachments,
	attachmentList,
	mainFileId,
	mainFileName,
	projectId,
	parentId,
	setActiveIndex,
	setIsTransitioning,
	onSortSave,
	store,
	isAnySlideEditing = false,
}: UsePPTSidebarOptions) {
	const { t } = useTranslation("super")
	const isInsertingRef = useRef(false)
	const isDeletingRef = useRef(false)
	const [isDeleteModalOpen, setIsModalOpen] = useState(false)

	// Register unified sync function on mount
	useMount(() => {
		// Track the last successfully synced state to avoid duplicate onSortSave calls
		let lastSyncedPaths: string[] = []

		store.syncManager.registerSyncFunction(
			// Sync function: update magic.project.js
			async (slidesToSync: SlideItem[]) => {
				const magicProjectFile = await findMagicProjectJsFile({
					attachments: attachments || [],
					currentFileId: mainFileId || "",
					currentFileName: mainFileName || "",
				})

				if (!magicProjectFile) {
					throw new Error("Magic project file not found")
				}

				const newSlidesOrder = slidesToSync.map((slide) => slide.path)

				await updateSlidesOrder({
					fileId: magicProjectFile.fileId,
					newSlidesOrder,
				})

				// Only notify parent if the synced state is different from last sync
				const currentPathsStr = newSlidesOrder.join(",")
				const lastPathsStr = lastSyncedPaths.join(",")

				if (currentPathsStr !== lastPathsStr) {
					lastSyncedPaths = newSlidesOrder
					// Notify parent with updated paths after successful sync
					// Mark to skip next external sync to prevent circular update
					store.markSkipNextExternalSync()
					if (onSortSave) {
						onSortSave(newSlidesOrder)
					}
				}
			},
			// Rollback function: restore previous state
			(previousSlides: SlideItem[]) => {
				store.setSlides(previousSlides, true) // skipSync = true to avoid triggering another sync
				const rolledBackPaths = store.slidePaths
				lastSyncedPaths = rolledBackPaths
				if (onSortSave) {
					onSortSave(rolledBackPaths)
				}
				toast.error(t("fileViewer.updateSlideFailed"))
			},
		)
	})

	// Handle sidebar slide click for navigation
	const handleSlideClick = useMemoizedFn(async (index: number) => {
		if (slides.length === 0 || isTransitioning) return
		if (index === activeIndex) return

		setIsTransitioning(true)
		await setActiveIndex(index)
		setIsTransitioning(false)
	})

	// Handle sidebar sort change - simplified with unified sync
	const handleSortChange = useMemoizedFn((newSlides: SlideItem[]) => {
		if (!allowEdit) return

		// Optimistic update: immediately update local state
		// SyncManager will automatically debounce and sync to magic.project.js
		// Note: onSortSave will be called by syncManager after successful sync
		store.sortSlides(newSlides)

		// Note: onSortSave is NOT called here to prevent race conditions
		// It will be called by syncManager after successful debounced sync
	})

	// Handle insert slide without optimistic update
	const handleInsertSlide = useMemoizedFn(
		async (position: number, direction: "before" | "after") => {
			if (!allowEdit) return
			if (!projectId) {
				magicToast.error(t("fileViewer.insertSlideFailed"))
				return
			}

			// Prevent concurrent inserts
			if (isInsertingRef.current) {
				magicToast.warning(t("fileViewer.waitForPreviousOperation"))
				return
			}

			// Calculate insertion index
			const insertIndex = direction === "before" ? position : position + 1

			// Set inserting flag
			isInsertingRef.current = true

			// Show loading toast
			const toastId = magicToast.loading({
				content: t("fileViewer.insertingSlide"),
				duration: 0,
			})

			try {
				// Find magic project file
				const magicProjectFile = await findMagicProjectJsFile({
					attachments: attachments || [],
					currentFileId: mainFileId || "",
					currentFileName: mainFileName || "",
				})

				if (!magicProjectFile) {
					throw new Error("Magic project file not found")
				}

				// Insert slide via API (this will update magic.project.js internally)
				const result = await insertSlide({
					projectId,
					parentId,
					position,
					direction,
					currentSlides: store.slides.map((s) => s.path),
					magicProjectFileId: magicProjectFile.fileId,
					attachments: attachments || [],
				})

				// Get download URL for the newly created file
				const downloadUrls = await getTemporaryDownloadUrl({
					file_ids: [result.newFileId],
				})

				if (!downloadUrls || !downloadUrls[0] || !downloadUrls[0].url) {
					throw new Error("Failed to get download URL for new slide")
				}

				const newFileUrl = downloadUrls[0].url

				let targetSlideIndex = store.slides.findIndex(
					(slide) => slide.path === result.newFilePath,
				)
				const didInsertNewSlide = targetSlideIndex === -1

				// Keep insert idempotent when external sync arrives first
				if (targetSlideIndex !== -1) {
					const newSlides = [...store.slides]
					const existingSlide = newSlides[targetSlideIndex]
					newSlides[targetSlideIndex] = {
						...existingSlide,
						id: existingSlide.id || `slide-${result.newFileId}`,
						url: newFileUrl,
						loadingState: existingSlide.loadingState || "loading",
						title: result.newFile.file_name,
					}
					newSlides.forEach((slide, idx) => {
						slide.index = idx
					})
					store.setSlides(newSlides, true) // skipSync = true
				} else {
					const clampedInsertIndex = Math.min(
						Math.max(0, insertIndex),
						store.slides.length,
					)
					const newSlide: SlideItem = {
						id: `slide-${result.newFileId}`,
						path: result.newFilePath,
						url: newFileUrl,
						index: clampedInsertIndex,
						loadingState: "loading",
						title: result.newFile.file_name,
					}
					const newSlides = [...store.slides]
					newSlides.splice(clampedInsertIndex, 0, newSlide)
					newSlides.forEach((slide, idx) => {
						slide.index = idx
					})
					store.setSlides(newSlides, true) // skipSync = true
					targetSlideIndex = clampedInsertIndex
				}

				if (targetSlideIndex === -1) {
					targetSlideIndex = store.slides.findIndex(
						(slide) => slide.path === result.newFilePath,
					)
				}

				if (targetSlideIndex === -1) {
					throw new Error("Failed to resolve inserted slide index")
				}

				// Update path mappings
				store.pathMappingService.setPathFileIdMapping(result.newFilePath, result.newFileId)
				store.pathMappingService.setPathUrlMapping(result.newFilePath, newFileUrl)

				// Determine the final active index to avoid conflicts
				let finalActiveIndex = store.activeIndex

				// Adjust active index only when we actually inserted a new item
				if (didInsertNewSlide && targetSlideIndex <= store.activeIndex) {
					finalActiveIndex = store.activeIndex + 1
				}

				// Navigate to newly inserted slide if not in edit mode
				if (!isAnySlideEditing) {
					finalActiveIndex = targetSlideIndex
				}

				// Apply the final active index only once
				if (finalActiveIndex !== store.activeIndex) {
					store.setActiveIndex(finalActiveIndex)
				}

				// CRITICAL FIX: Mark to skip next external sync to prevent double insertion
				// This prevents handleIncrementalUpdate from treating backend response as a change
				store.markSkipNextExternalSync()

				// Notify parent with updated paths (AFTER all state updates to prevent race)
				if (onSortSave) {
					onSortSave(store.slidePaths)
				}

				// Load the new slide content and generate screenshot
				try {
					await store.loadSlideContent(newFileUrl, targetSlideIndex)
					await store.generateSlideScreenshot(targetSlideIndex)

					// Validate that we have the required file information
					if (!result.newFileId) {
						console.error("Missing newFileId, cannot insert to chat")
						return
					}

					// 将新文件添加到 store 中,确保 mention 验证能够通过
					projectFilesStore.addWorkspaceFile(result.newFile)

					const contentToInsert = {
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [
									{
										type: "text",
										text: t("fileViewer.newSlidePromptPrefix"),
									},
									{
										type: "mention",
										attrs: {
											id: result.newFile.file_id,
											label: result.newFile.file_name,
											mentionSuggestionChar: "@",
											type: MentionItemType.PROJECT_FILE,
											data: {
												file_id: result.newFile.file_id,
												file_name: result.newFile.file_name,
												file_path: result.newFile.relative_file_path,
												file_extension: result.newFile.file_extension,
											},
										},
									},
									{
										type: "text",
										text: t("fileViewer.newSlidePromptSuffix"),
									},
									{
										type: "super-placeholder",
										attrs: {
											type: "input",
											props: {
												placeholder: t(
													"fileViewer.newSlidePromptPlaceholder",
												),
												defaultValue: "",
												value: "",
											},
										},
									},
								],
							},
						],
					}

					pubsub.publish(PubSubEvents.Set_Content_When_Slide_Added, {
						content: contentToInsert,
					})

					pubsub.publish(PubSubEvents.Update_Attachments)
				} catch (loadError) {
					console.error("Failed to load slide content or generate screenshot:", loadError)
					// The slide is still inserted, just not fully loaded
				}

				// Dismiss loading toast and show success message
				magicToast.destroy(toastId)
				magicToast.success(t("fileViewer.insertSlideSuccess"))
			} catch (error) {
				console.error("Failed to insert slide:", error)

				// Dismiss loading toast and show error message
				magicToast.destroy(toastId)
				magicToast.error(t("fileViewer.insertSlideFailed"))
			} finally {
				// Reset inserting flag
				isInsertingRef.current = false
			}
		},
	)

	// Handle delete slide with optimistic update
	const handleDeleteSlide = useMemoizedFn((index: number) => {
		if (!allowEdit) return

		// Prevent concurrent deletion of any slides
		if (isDeletingRef.current) {
			magicToast.warning(t("fileViewer.waitForPreviousOperation"))
			return
		}

		// Validate minimum slides count
		if (store.slidePaths.length <= 1) {
			magicToast.error(t("fileViewer.cannotDeleteLastSlide"))
			return
		}

		// Capture slide info at the start based on index
		const slideToDelete = store.slides[index]
		if (!slideToDelete) {
			magicToast.error(t("fileViewer.deleteSlideFailed"))
			return
		}

		const slidePath = slideToDelete.path
		const fileId = store.getFileIdByPath(slidePath)

		// CRITICAL: Capture slides snapshot BEFORE modal opens to avoid optimistic update pollution
		// This snapshot represents the TRUE backend state at the moment user clicks delete
		const slidesSnapshotForApi = [...store.slides]
		const activeIndexSnapshot = store.activeIndex

		// Mark as deleting to prevent concurrent deletion
		isDeletingRef.current = true

		// Mark modal as open to disable keyboard navigation
		setIsModalOpen(true)

		// Show confirmation modal
		const { destroy: destroyModal } = MagicModal.confirm({
			title: t("fileViewer.deleteSlideConfirmTitle"),
			content: t("fileViewer.deleteSlideConfirmContent"),
			variant: "destructive",
			showIcon: true,
			okText: t("fileViewer.deleteSlide"),
			cancelText: t("fileViewer.cancel"),
			onCancel: () => {
				// Reset deleting flag if user cancels
				isDeletingRef.current = false
				// Reset modal open state
				setIsModalOpen(false)
			},
			onOk: async () => {
				// Use the snapshot captured at function entry (before any optimistic updates)
				// This represents the true backend state when user clicked delete
				const previousSlides = slidesSnapshotForApi
				const previousActiveIndex = activeIndexSnapshot

				try {
					// Find current index by path in the snapshot (not in potentially modified store.slides)
					const currentIndex = previousSlides.findIndex((s) => s.path === slidePath)
					if (currentIndex === -1) {
						throw new Error("Slide not found")
					}

					// Optimistic update: immediately delete from local state (skipSync to avoid duplicate sync)
					const newSlides = store.slides.filter((s) => s.path !== slidePath)
					newSlides.forEach((slide, idx) => {
						slide.index = idx
					})
					store.setSlides(newSlides, true) // skipSync = true

					// Determine new active index based on current store state
					let newActiveIndex = store.activeIndex
					const currentStoreIndex = store.slides.findIndex((s) => s.path === slidePath)

					// If slide is currently active or before active, adjust activeIndex
					if (currentStoreIndex !== -1) {
						if (currentStoreIndex === store.activeIndex) {
							newActiveIndex = Math.max(0, currentStoreIndex - 1)
						} else if (currentStoreIndex < store.activeIndex) {
							newActiveIndex = store.activeIndex - 1
						}
					}

					store.setActiveIndex(newActiveIndex)
					setActiveIndex(newActiveIndex)

					// CRITICAL FIX: Mark to skip next external sync to prevent double deletion
					// This prevents handleIncrementalUpdate from treating backend response as a change
					store.markSkipNextExternalSync()

					// Notify parent with updated paths immediately
					if (onSortSave) {
						onSortSave(store.slidePaths)
					}

					destroyModal()

					// Show loading toast after optimistic update
					const toastId = magicToast.loading({
						content: t("fileViewer.deletingSlide"),
						duration: 0,
					})

					// Background API calls (deleteSlide API will update magic.project.js)
					const magicProjectFile = await findMagicProjectJsFile({
						attachments: attachments || [],
						currentFileId: mainFileId || "",
						currentFileName: mainFileName || "",
					})

					if (!magicProjectFile) {
						throw new Error("Magic project file not found")
					}

					// Delete HTML file if fileId exists
					if (fileId) {
						try {
							await SuperMagicApi.deleteFile(fileId)
						} catch (error) {
							console.error("Failed to delete HTML file:", error)
							// Continue with deletion even if file deletion fails
						}
					}

					// Delete slide via API (updates magic.project.js internally)
					// Use snapshot captured at function entry to represent true backend state
					await deleteSlide({
						slidePath,
						currentSlides: previousSlides.map((s) => s.path),
						magicProjectFileId: magicProjectFile.fileId,
						minSlidesCount: 1,
					})

					pubsub.publish(PubSubEvents.Update_Attachments)

					// Show success toast after API completes
					magicToast.destroy(toastId)
					magicToast.success(t("fileViewer.deleteSlideSuccess"))
				} catch (error) {
					console.error("Failed to delete slide:", error)

					// Rollback on failure
					store.setSlides(previousSlides, true) // skipSync = true
					store.setActiveIndex(previousActiveIndex)
					setActiveIndex(previousActiveIndex)

					if (onSortSave) {
						onSortSave(store.slidePaths)
					}

					magicToast.error(t("fileViewer.deleteSlideFailed"))
				} finally {
					// Always reset deleting flag when done
					isDeletingRef.current = false
					// Reset modal open state
					setIsModalOpen(false)
				}
			},
		})
	})

	// Handle rename slide with optimistic update
	const handleRenameSlide = useMemoizedFn(async (index: number, newFileName: string) => {
		if (!allowEdit) return

		// Capture slide info at the start based on index
		const slideToRename = store.slides[index]
		const oldPath = slideToRename?.path

		if (!oldPath) {
			magicToast.error(t("fileViewer.renameSlideFailed"))
			return
		}

		// Get file ID
		const fileId = store.getFileIdByPath(oldPath)
		if (!fileId) {
			magicToast.error(t("fileViewer.renameSlideFailed"))
			return
		}

		// Calculate new path (optimistic)
		// Extract file extension from old path and append to new file name
		const pathParts = oldPath.split("/")
		const oldFileName = pathParts[pathParts.length - 1]
		const extensionMatch = oldFileName.match(/\.[^.]+$/)
		const extension = extensionMatch ? extensionMatch[0] : ""
		const newFileNameWithExtension = newFileName.endsWith(extension)
			? newFileName
			: newFileName + extension
		pathParts[pathParts.length - 1] = newFileNameWithExtension
		const optimisticNewPath = pathParts.join("/")

		// Save current state for rollback
		const previousSlides = [...store.slides]

		try {
			// Find current index by old path (in case slides array changed)
			const currentIndex = store.slides.findIndex((s) => s.path === oldPath)
			if (currentIndex === -1) {
				throw new Error("Slide not found")
			}

			// Optimistic update: immediately update local state by path
			const updatedSlides = store.slides.map((slide) =>
				slide.path === oldPath ? { ...slide, path: optimisticNewPath } : slide,
			)
			store.setSlides(updatedSlides, true) // skipSync = true

			// Update path mappings
			const currentUrl = store.pathMappingService.getUrlByPath(oldPath)
			if (fileId) {
				store.pathMappingService.setPathFileIdMapping(optimisticNewPath, fileId)
			}
			if (currentUrl) {
				store.pathMappingService.setPathUrlMapping(optimisticNewPath, currentUrl)
			}

			// Notify parent with updated paths immediately
			if (onSortSave) {
				onSortSave(store.slidePaths)
			}

			// Background API calls (renameSlide API will update magic.project.js)
			const magicProjectFile = await findMagicProjectJsFile({
				attachments: attachments || [],
				currentFileId: mainFileId || "",
				currentFileName: mainFileName || "",
			})

			if (!magicProjectFile) {
				throw new Error("Magic project file not found")
			}

			// Rename slide via API (renames HTML file and updates magic.project.js internally)
			// Use path-based rename for reliability in concurrent scenarios
			const result = await renameSlide({
				oldPath,
				newFileName,
				currentSlides: previousSlides.map((s) => s.path),
				magicProjectFileId: magicProjectFile.fileId,
				fileId,
			})

			// Update with actual path from API if different
			if (result.newFilePath !== optimisticNewPath) {
				// Find slide by optimistic path and update to actual path
				const finalSlides = store.slides.map((slide) =>
					slide.path === optimisticNewPath
						? { ...slide, path: result.newFilePath }
						: slide,
				)

				store.setSlides(finalSlides, true) // skipSync = true

				// Update path mappings with final path
				if (fileId) {
					store.pathMappingService.setPathFileIdMapping(result.newFilePath, fileId)
				}
				if (currentUrl) {
					store.pathMappingService.setPathUrlMapping(result.newFilePath, currentUrl)
				}

				if (onSortSave) {
					onSortSave(store.slidePaths)
				}

				pubsub.publish(PubSubEvents.Update_Attachments)
			}
		} catch (error) {
			console.error("Failed to rename slide:", error)

			// Rollback on failure - restore to previous slides state
			store.setSlides(previousSlides, true) // skipSync = true

			// Restore path mappings
			const currentUrl = store.pathMappingService.getUrlByPath(optimisticNewPath)
			if (fileId) {
				store.pathMappingService.setPathFileIdMapping(oldPath, fileId)
			}
			if (currentUrl) {
				store.pathMappingService.setPathUrlMapping(oldPath, currentUrl)
			}

			if (onSortSave) {
				onSortSave(store.slidePaths)
			}

			magicToast.error(t("fileViewer.renameSlideFailed"))
		}
	})

	// Convert slide to AttachmentItem format by fileId
	const convertSlideToAttachmentItem = (fileId: string): AttachmentItem | null => {
		// Find file info from attachmentList by fileId
		const fileInfo = attachmentList?.find((item: any) => item.file_id === fileId)
		if (!fileInfo) return null

		return fileInfo
	}

	// Handle add to current chat
	const handleAddToCurrentChat = useMemoizedFn((index: number) => {
		try {
			// Capture slide info at the start based on index
			const slide = store.slides[index]
			if (!slide) {
				magicToast.error(t("fileViewer.addToCurrentChatFailed"))
				return
			}

			const fileId = store.getFileIdByPath(slide.path)
			if (!fileId) {
				magicToast.error(t("fileViewer.addToCurrentChatFailed"))
				return
			}

			const attachmentItem = convertSlideToAttachmentItem(fileId)
			if (!attachmentItem) {
				magicToast.error(t("fileViewer.addToCurrentChatFailed"))
				return
			}

			addFileToCurrentChat({
				fileItem: attachmentItem,
				isNewTopic: false,
				autoFocus: true,
			})
		} catch (error) {
			console.error("Failed to add slide to current chat:", error)
			magicToast.error(t("fileViewer.addToCurrentChatFailed"))
		}
	})

	// Handle add to new chat
	const handleAddToNewChat = useMemoizedFn(async (index: number) => {
		try {
			// Capture slide info at the start based on index
			const slide = store.slides[index]
			if (!slide) {
				magicToast.error(t("fileViewer.addToNewChatFailed"))
				return
			}

			const fileId = store.getFileIdByPath(slide.path)
			if (!fileId) {
				magicToast.error(t("fileViewer.addToNewChatFailed"))
				return
			}

			const attachmentItem = convertSlideToAttachmentItem(fileId)
			if (!attachmentItem) {
				magicToast.error(t("fileViewer.addToNewChatFailed"))
				return
			}

			const selectedWorkspace = workspaceStore.selectedWorkspace
			const selectedProject = projectStore.selectedProject

			await addFileToNewChat({
				fileItem: attachmentItem,
				selectedWorkspace,
				selectedProject,
				autoFocus: true,
			})
		} catch (error) {
			console.error("Failed to add slide to new chat:", error)
			magicToast.error(t("fileViewer.addToNewChatFailed"))
		}
	})

	return {
		handleSlideClick,
		handleSortChange,
		handleInsertSlide,
		handleDeleteSlide,
		handleRenameSlide,
		handleAddToCurrentChat,
		handleAddToNewChat,
		isDeleteModalOpen,
	}
}
