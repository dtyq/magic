import { useMemoizedFn, useMount } from "ahooks"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	findMagicProjectJsFile,
	updateSlidesOrder,
	insertSlide,
	duplicateSlide,
	deleteSlide,
	renameSlide,
} from "../../../contents/HTML/utils/magicProjectUpdater"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
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
import { requestProjectAttachmentsFullRefresh } from "@/pages/superMagic/services/attachmentsTopicSync"
import type { PPTSlideStructureAdapter } from "../types"
import { reconcilePPTTransitions } from "../utils/pptTransitions"

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
	slideStructureAdapter?: PPTSlideStructureAdapter
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
	slideStructureAdapter,
}: UsePPTSidebarOptions) {
	const { t } = useTranslation("super")
	// Bound to the ambient FileAccessProvider identity so share previews send their share access.
	const fileApi = useFileApi()
	const isInsertingRef = useRef(false)
	const isDuplicatingRef = useRef(false)
	const isDeletingRef = useRef(false)
	const slideStructureAdapterRef = useRef(slideStructureAdapter)
	slideStructureAdapterRef.current = slideStructureAdapter
	const [isDeleteModalOpen, setIsModalOpen] = useState(false)
	const getMagicProjectLookupAttachments = useMemoizedFn((): AttachmentItem[] => {
		const treeAttachments = Array.isArray(attachments) ? (attachments as AttachmentItem[]) : []
		const listAttachments = Array.isArray(attachmentList)
			? (attachmentList as AttachmentItem[])
			: []
		if (treeAttachments.length === 0) return listAttachments
		if (listAttachments.length === 0) return treeAttachments
		return [...treeAttachments, ...listAttachments]
	})

	// Register unified sync function on mount
	useMount(() => {
		// Track the last successfully synced state to avoid duplicate onSortSave calls
		let lastSyncedPaths: string[] = []

		store.syncManager.registerSyncFunction(
			// Sync function: update magic.project.js
			async (slidesToSync: SlideItem[]) => {
				const newSlidesOrder = slidesToSync.map((slide) => slide.path)
				const currentStructureAdapter = slideStructureAdapterRef.current
				if (currentStructureAdapter) {
					await currentStructureAdapter.reorder(newSlidesOrder)
					const currentPathsStr = newSlidesOrder.join(",")
					const lastPathsStr = lastSyncedPaths.join(",")
					if (currentPathsStr !== lastPathsStr) {
						lastSyncedPaths = newSlidesOrder
						store.markSkipNextExternalSync()
						onSortSave?.(newSlidesOrder)
					}
					return
				}

				const magicProjectFile = await findMagicProjectJsFile({
					attachments: getMagicProjectLookupAttachments(),
					currentFileId: mainFileId || "",
					currentFileName: mainFileName || "",
				})

				if (!magicProjectFile) {
					throw new Error("Magic project file not found")
				}

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
			if (!projectId && !slideStructureAdapter) {
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
				if (slideStructureAdapter) {
					const result = await slideStructureAdapter.insert({
						position,
						direction,
					})
					const downloadUrls = await fileApi.getTemporaryDownloadUrl({
						file_ids: [result.fileId],
					})
					const newFileUrl = downloadUrls?.[0]?.url || ""

					const insertIndex = direction === "before" ? position : position + 1
					const clampedIndex = Math.min(Math.max(0, insertIndex), store.slides.length)
					const newSlide: SlideItem = {
						id: `slide-${result.fileId}`,
						path: result.filePath,
						url: newFileUrl,
						index: clampedIndex,
						loadingState: "loading",
						title: result.filePath.split("/").pop(),
					}
					const newSlides = [...store.slides]
					newSlides.splice(clampedIndex, 0, newSlide)
					newSlides.forEach((slide, index) => {
						slide.index = index
					})
					store.setSlides(newSlides, true)
					store.pathMappingService.setPathFileIdMapping(result.filePath, result.fileId)
					if (newFileUrl) {
						store.pathMappingService.setPathUrlMapping(result.filePath, newFileUrl)
					}
					store.setActiveIndex(clampedIndex)
					store.markSkipNextExternalSync()
					onSortSave?.(store.slidePaths)
					projectFilesStore.addWorkspaceFile({
						file_id: result.fileId,
						file_name: result.filePath.split("/").pop(),
						relative_file_path: result.filePath,
					})
					requestProjectAttachmentsFullRefresh({
						projectId,
						reason: "ppt-template-insert-slide",
					})
					await store.loadSlideContentByFileId(result.fileId, {
						path: result.filePath,
						url: newFileUrl,
						indexHint: clampedIndex,
					})
					await store.ensureSlideScreenshot(clampedIndex)
					magicToast.destroy(toastId)
					magicToast.success(t("fileViewer.insertSlideSuccess"))
					return
				}

				// Find magic project file
				const magicProjectFile = await findMagicProjectJsFile({
					attachments: getMagicProjectLookupAttachments(),
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
					attachments: getMagicProjectLookupAttachments(),
				})

				// Get download URL for the newly created file
				const downloadUrls = await fileApi.getTemporaryDownloadUrl({
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

				// 将新文件添加到 store 中，确保 mention 验证能够通过；随后触发完整刷新，回到服务端附件树状态。
				projectFilesStore.addWorkspaceFile(result.newFile)
				requestProjectAttachmentsFullRefresh({
					projectId,
					reason: "ppt-insert-slide",
				})

				// Load the new slide content and generate screenshot
				try {
					await store.loadSlideContentByFileId(result.newFileId, {
						path: result.newFilePath,
						url: newFileUrl,
						indexHint: targetSlideIndex,
					})
					const screenshotIndex = store.slides.findIndex(
						(slide) => store.getFileIdByPath(slide.path) === result.newFileId,
					)
					await store.ensureSlideScreenshot(
						screenshotIndex === -1 ? targetSlideIndex : screenshotIndex,
					)

					// Validate that we have the required file information
					if (!result.newFileId) {
						console.error("Missing newFileId, cannot insert to chat")
						return
					}

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

	const handleDuplicateSlide = useMemoizedFn(async (index: number) => {
		if (!allowEdit) return
		if (!projectId && !slideStructureAdapter) {
			magicToast.error(t("fileViewer.duplicateSlideFailed"))
			return
		}
		if (isDuplicatingRef.current) {
			magicToast.warning(t("fileViewer.waitForPreviousOperation"))
			return
		}

		const sourceSlide = store.slides[index]
		const sourceFileId = sourceSlide ? store.getFileIdByPath(sourceSlide.path) : undefined
		if (!sourceSlide || (!slideStructureAdapter && !sourceFileId)) {
			magicToast.error(t("fileViewer.duplicateSlideFailed"))
			return
		}

		isDuplicatingRef.current = true
		const toastId = magicToast.loading({
			content: t("fileViewer.duplicatingSlide"),
			duration: 0,
		})

		try {
			let result: {
				filePath: string
				fileId: string
				content: string
				file: AttachmentItem
			}

			// Both structure implementations persist first; the sidebar is updated only after the
			// new file and page order are durable, so a failed copy cannot leave a phantom page.
			if (slideStructureAdapter) {
				const duplicateResult = await slideStructureAdapter.duplicate({
					slidePath: sourceSlide.path,
					position: index,
				})
				result = {
					...duplicateResult,
					file: {
						file_id: duplicateResult.fileId,
						file_name: duplicateResult.filePath.split("/").pop(),
						file_extension: "html",
						relative_file_path: duplicateResult.filePath,
					},
				}
			} else {
				const magicProjectFile = await findMagicProjectJsFile({
					attachments: getMagicProjectLookupAttachments(),
					currentFileId: mainFileId || "",
					currentFileName: mainFileName || "",
				})
				if (!magicProjectFile) throw new Error("Magic project file not found")

				const duplicateResult = await duplicateSlide({
					projectId: projectId as string,
					parentId,
					slidePath: sourceSlide.path,
					position: index,
					currentSlides: store.slidePaths,
					magicProjectFileId: magicProjectFile.fileId,
					sourceFileId: sourceFileId as string,
					attachments: getMagicProjectLookupAttachments(),
				})
				result = {
					filePath: duplicateResult.newFilePath,
					fileId: duplicateResult.newFileId,
					content: duplicateResult.content,
					file: duplicateResult.newFile,
				}
			}

			let newFileUrl = ""
			try {
				const downloadUrls = await fileApi.getTemporaryDownloadUrl({
					file_ids: [result.fileId],
				})
				newFileUrl = downloadUrls?.[0]?.url || ""
			} catch (error) {
				console.error("Failed to get duplicated slide URL:", error)
			}
			let targetIndex = store.slides.findIndex((slide) => slide.path === result.filePath)

			// External attachment sync can arrive before this handler resumes. Reuse the existing
			// path when that happens instead of inserting the same copied page twice.
			if (targetIndex === -1) {
				targetIndex = Math.min(index + 1, store.slides.length)
				const newSlides = [...store.slides]
				newSlides.splice(targetIndex, 0, {
					id: `slide-${result.fileId}`,
					path: result.filePath,
					url: newFileUrl,
					index: targetIndex,
					title: result.filePath.split("/").pop(),
					loadingState: "loading",
				})
				newSlides.forEach((slide, slideIndex) => {
					slide.index = slideIndex
				})
				store.setSlides(newSlides, true)
			}

			store.pathMappingService.setPathFileIdMapping(result.filePath, result.fileId)
			if (newFileUrl) store.pathMappingService.setPathUrlMapping(result.filePath, newFileUrl)
			store.setActiveIndex(targetIndex)
			store.markSkipNextExternalSync()
			onSortSave?.(store.slidePaths)

			projectFilesStore.addWorkspaceFile(result.file)
			requestProjectAttachmentsFullRefresh({
				projectId,
				reason: slideStructureAdapter
					? "ppt-template-duplicate-slide"
					: "ppt-duplicate-slide",
			})

			try {
				await store.loadSlideContentByFileId(result.fileId, {
					path: result.filePath,
					url: newFileUrl,
					indexHint: targetIndex,
				})
				const screenshotIndex = store.slides.findIndex(
					(slide) => store.getFileIdByPath(slide.path) === result.fileId,
				)
				await store.ensureSlideScreenshot(
					screenshotIndex === -1 ? targetIndex : screenshotIndex,
				)
			} catch (error) {
				// Persistence succeeded; preview failures should not report a failed copy.
				console.error("Failed to load duplicated slide or generate screenshot:", error)
			}

			magicToast.destroy(toastId)
			magicToast.success(t("fileViewer.duplicateSlideSuccess"))
		} catch (error) {
			console.error("Failed to duplicate slide:", error)
			magicToast.destroy(toastId)
			magicToast.error(t("fileViewer.duplicateSlideFailed"))
		} finally {
			isDuplicatingRef.current = false
		}
	})

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

					// Determine new active index from the pre-delete snapshot.
					let newActiveIndex = previousActiveIndex

					// If slide is currently active or before active, adjust activeIndex
					if (currentIndex === previousActiveIndex) {
						newActiveIndex = Math.max(0, currentIndex - 1)
					} else if (currentIndex < previousActiveIndex) {
						newActiveIndex = previousActiveIndex - 1
					}
					newActiveIndex = Math.min(newActiveIndex, newSlides.length - 1)

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

					if (slideStructureAdapter) {
						await slideStructureAdapter.remove(slidePath)
						requestProjectAttachmentsFullRefresh({
							projectId,
							reason: "ppt-template-delete-slide",
						})
						magicToast.destroy(toastId)
						magicToast.success(t("fileViewer.deleteSlideSuccess"))
						return
					}

					// Background API calls (deleteSlide API will update magic.project.js)
					const magicProjectFile = await findMagicProjectJsFile({
						attachments: getMagicProjectLookupAttachments(),
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

					// Show success toast after API completes
					magicToast.destroy(toastId)
					magicToast.success(t("fileViewer.deleteSlideSuccess"))
				} catch (error) {
					console.error("Failed to delete slide:", error)
					if (slideStructureAdapter) {
						const restoredFileId = slideStructureAdapter.getFileId?.(slidePath)
						if (restoredFileId) {
							store.pathMappingService.setPathFileIdMapping(slidePath, restoredFileId)
						}
						requestProjectAttachmentsFullRefresh({
							projectId,
							reason: "ppt-template-delete-slide-rollback",
						})
					}

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
		if (!allowEdit) return false

		// Capture slide info at the start based on index
		const slideToRename = store.slides[index]
		const oldPath = slideToRename?.path

		if (!oldPath) {
			magicToast.error(t("fileViewer.renameSlideFailed"))
			return false
		}

		// Get file ID
		const fileId = store.getFileIdByPath(oldPath)
		if (!fileId) {
			magicToast.error(t("fileViewer.renameSlideFailed"))
			return false
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

			if (slideStructureAdapter) {
				const newPath = await slideStructureAdapter.rename(oldPath, newFileName)
				if (newPath !== optimisticNewPath) {
					const finalSlides = store.slides.map((slide) =>
						slide.path === optimisticNewPath ? { ...slide, path: newPath } : slide,
					)
					store.setSlides(finalSlides, true)
					store.pathMappingService.setPathFileIdMapping(newPath, fileId)
					if (currentUrl) {
						store.pathMappingService.setPathUrlMapping(newPath, currentUrl)
					}
				}
				onSortSave?.(store.slidePaths)
				requestProjectAttachmentsFullRefresh({
					projectId,
					reason: "ppt-template-rename-slide",
				})
				return true
			}

			// Background API calls (renameSlide API will update magic.project.js)
			const magicProjectFile = await findMagicProjectJsFile({
				attachments: getMagicProjectLookupAttachments(),
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
			}

			// The manifest rename is confirmed now. Update its path-owned metadata immediately;
			// waiting for attachment refresh would temporarily play the renamed page's default.
			const displayConfig = store.getConfigForExport().displayConfig
			if (displayConfig?.transitions !== undefined) {
				await store.updateConfig({
					displayConfig: {
						...displayConfig,
						slides: store.slidePaths,
						transitions: reconcilePPTTransitions(
							displayConfig.transitions,
							store.slidePaths,
							{
								renamePath: { from: oldPath, to: result.newFilePath },
							},
						),
					},
				})
			}
			requestProjectAttachmentsFullRefresh({
				projectId,
				reason: "ppt-rename-slide",
			})
			return true
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
			return false
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
		handleDuplicateSlide,
		handleDeleteSlide,
		handleRenameSlide,
		handleAddToCurrentChat,
		handleAddToNewChat,
		isDeleteModalOpen,
	}
}
