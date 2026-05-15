import {
	useCallback,
	useState,
	type ClipboardEvent,
	type CSSProperties,
	type MutableRefObject,
} from "react"
import { ArrowUp, LoaderCircle } from "lucide-react"
import { useCanvas } from "../../context/CanvasContext"
import type { ImageElement } from "../../canvas/types"
import type { ReferenceResourceSourceType } from "../MessageEditor/reference-assets/reference-resource.types"
import type { ReferenceResourcePanelItem } from "../../types"
import MessageEditor, { type MessageEditorRef } from "../MessageEditor/MessageEditor"
import { useMessageEditorMention } from "../MessageEditor/useMessageEditorMention"
import { useMentionSync } from "../MessageEditor/useMentionSync"
import { removeMentionFromString } from "../MessageEditor/tiptap/contentUtils"
import { ReferenceResourceDropSurface } from "../MessageEditor/reference-assets/ReferenceResourceDropSurface"
import { createReferenceResourcePanelItemFromDropFile } from "../MessageEditor/reference-assets/createReferenceResourcePanelItem"
import {
	checkLocalReferenceResourceDrop,
	checkProjectReferenceResourceDrop,
	getReferenceResourceHoverState,
	getReferenceResourceLocalHoverState,
	normalizeProjectDropFiles,
	type ReferenceDropProjectFile,
	useReferenceResourceDrop,
} from "../MessageEditor/reference-assets/useReferenceResourcePanelDataService"
import useElementPositionEffect from "../../hooks/useElementPositionEffect"
import { useFloatingComponent } from "../../hooks/useFloatingComponent"
import { Button } from "../ui/button"
import ImageEditorControls from "./ImageEditorControls"
import type { ImageEditorConfig } from "./useImageEditorConfig"
import styles from "./index.module.css"

interface ImageEditorSurfaceProps {
	imageElement: ImageElement
	config: ImageEditorConfig
	editorRef: MutableRefObject<MessageEditorRef | null>
	shouldShow: () => boolean
	floatingId: string
	selectionPersistenceKey: string
	placeholder: string
	onSend: () => void | Promise<void>
	isSending: boolean
	autoFocus?: boolean
	autoFocusAtDocumentEnd?: boolean
	isDropEnabled?: boolean
	protectedReferenceFileIndex?: number
	className?: string
	style?: CSSProperties
}

export default function ImageEditorSurface(props: ImageEditorSurfaceProps) {
	const {
		imageElement,
		config,
		editorRef,
		shouldShow,
		floatingId,
		selectionPersistenceKey,
		placeholder,
		onSend,
		isSending,
		autoFocus,
		autoFocusAtDocumentEnd,
		isDropEnabled = true,
		protectedReferenceFileIndex,
		className,
		style,
	} = props
	const { canvas } = useCanvas()
	const [hasScrollbar, setHasScrollbar] = useState(false)
	const {
		prompt,
		handlers,
		fileInputRef,
		fileInputAccept,
		maxReferenceFiles,
		currentReferenceFiles,
		isReferenceFileLimitReached,
	} = config

	const { matchableItems, mentionDataService, mentionExtension, mentionEnabled } =
		useMessageEditorMention({
			matchableItems: config.matchableItems,
			maxReferenceFiles,
			currentReferenceFiles,
			isReferenceFileLimitReached,
			referenceResourceType: config.referenceResourceType,
		})

	const { syncMentionPaths } = useMentionSync({
		canvas,
		elementId: imageElement.id,
		matchableItems,
		protectedReferenceFileIndex,
		maxReferenceFiles,
		isReferenceFileLimitReached,
		syncFromElement: config.handlers.syncReferenceFilesFromElement,
	})

	const { containerRef } = useElementPositionEffect({
		position: "bottom",
		offset: 12,
		shouldShow,
	})

	const { containerRef: floatingRef } = useFloatingComponent({
		id: floatingId,
		enableWheelForwarding: !hasScrollbar,
	})

	const setRefs = useCallback(
		(node: HTMLDivElement | null) => {
			containerRef.current = node
			floatingRef.current = node
		},
		[containerRef, floatingRef],
	)

	const handleSelectSource = useCallback(
		(source: ReferenceResourceSourceType) => {
			handlers.setPopoverOpen(false)
			if (source === "local-upload") {
				if (config.isReferenceFileLimitReached) {
					return
				}
				handlers.triggerFileSelect()
			}
		},
		[config.isReferenceFileLimitReached, handlers],
	)

	const handleProjectSelect = useCallback(
		(item: ReferenceResourcePanelItem) => {
			editorRef.current?.insertMentionItems([item])
		},
		[editorRef],
	)

	const canAcceptReferenceDrop =
		!config.isUploading && Boolean(maxReferenceFiles && maxReferenceFiles > 0)

	const canAcceptProjectFiles = useCallback(
		(files: ReferenceDropProjectFile[]) => {
			return checkProjectReferenceResourceDrop({
				isDropEnabled: canAcceptReferenceDrop,
				files,
				matchableItems,
				currentReferenceFiles,
				maxReferenceFiles,
			})
		},
		[canAcceptReferenceDrop, matchableItems, currentReferenceFiles, maxReferenceFiles],
	)

	const canAcceptLocalFiles = useCallback(
		(files: File[]) => {
			return checkLocalReferenceResourceDrop({
				isDropEnabled: canAcceptReferenceDrop,
				files,
				accept: fileInputAccept,
				currentReferenceFileCount: currentReferenceFiles.length,
				maxReferenceFiles,
			})
		},
		[canAcceptReferenceDrop, fileInputAccept, maxReferenceFiles, currentReferenceFiles],
	)

	const getHoverDropState = useCallback(
		() =>
			getReferenceResourceHoverState({
				isDropEnabled: canAcceptReferenceDrop,
				currentReferenceFileCount: currentReferenceFiles.length,
				maxReferenceFiles,
			}),
		[canAcceptReferenceDrop, maxReferenceFiles, currentReferenceFiles],
	)

	const getLocalHoverState = useCallback(
		(dataTransfer: DataTransfer | null) =>
			getReferenceResourceLocalHoverState({
				isDropEnabled: canAcceptReferenceDrop,
				dataTransfer,
				accept: fileInputAccept,
				currentReferenceFileCount: currentReferenceFiles.length,
				maxReferenceFiles,
			}),
		[canAcceptReferenceDrop, fileInputAccept, maxReferenceFiles, currentReferenceFiles],
	)

	const handleProjectFilesDrop = useCallback(
		(files: ReferenceDropProjectFile[]) => {
			const normalizedFiles = normalizeProjectDropFiles(
				files,
				matchableItems,
				currentReferenceFiles,
			)
			editorRef.current?.insertMentionItems(
				normalizedFiles.map((file) => createReferenceResourcePanelItemFromDropFile(file)),
			)
		},
		[currentReferenceFiles, editorRef, matchableItems],
	)

	const handlePaste = useCallback(
		(event: ClipboardEvent<HTMLDivElement>) => {
			const files = Array.from(event.clipboardData.files)
			if (files.length === 0) return
			if (!canAcceptLocalFiles(files).accepted) return

			event.preventDefault()
			void handlers.uploadFiles(files)
		},
		[canAcceptLocalFiles, handlers],
	)

	const { overlayState, dragEvents } = useReferenceResourceDrop({
		isEnabled: isDropEnabled,
		checkProjectFiles: canAcceptProjectFiles,
		checkLocalFiles: canAcceptLocalFiles,
		getProjectHoverState: getHoverDropState,
		getLocalHoverState,
		onDropProjectFiles: handleProjectFilesDrop,
		onDropLocalFiles: handlers.uploadFiles,
	})

	const handleMentionChange = useCallback(
		(paths: string[], currentPrompt: string) => {
			syncMentionPaths(paths, currentPrompt)
		},
		[syncMentionPaths],
	)

	const handleReferenceFileRemoveFromPopover = useCallback(
		(path: string) => {
			const currentPrompt = editorRef.current?.getCurrentPrompt() ?? prompt
			const fileName =
				config.referenceFileInfos.find((info) => info.path === path)?.fileName ??
				path.split("/").pop()
			handlers.setPrompt(removeMentionFromString(currentPrompt, path, fileName))
			handlers.handleReferenceFileRemove(path)
		},
		[config.referenceFileInfos, editorRef, handlers, prompt],
	)

	return (
		<ReferenceResourceDropSurface
			ref={setRefs}
			className={className ?? styles.imageMessageEditor}
			data-canvas-ui-component
			style={style}
			dropOverlayState={overlayState}
			dragEvents={dragEvents}
		>
			<input
				ref={fileInputRef}
				type="file"
				accept={fileInputAccept}
				multiple
				style={{ display: "none" }}
				onChange={handlers.handleFileChange}
			/>
			<MessageEditor
				ref={editorRef}
				autoFocus={autoFocus}
				autoFocusAtDocumentEnd={autoFocusAtDocumentEnd}
				fullWidth
				selectionPersistenceKey={selectionPersistenceKey}
				placeholder={placeholder}
				value={prompt}
				onChange={handlers.setPrompt}
				onEnter={onSend}
				onScrollbarChange={setHasScrollbar}
				matchableItems={matchableItems}
				mentionDataService={mentionDataService}
				mentionExtension={mentionExtension}
				onMentionChange={handleMentionChange}
				mentionEnabled={mentionEnabled}
				onPaste={handlePaste}
			/>
			<ImageEditorControls
				config={config}
				protectedReferenceFileIndex={protectedReferenceFileIndex}
				onSelectSource={handleSelectSource}
				onProjectSelect={handleProjectSelect}
				onReferenceFileRemove={handleReferenceFileRemoveFromPopover}
				renderSendButton={() => (
					<Button
						className={styles.sendButton}
						onClick={onSend}
						disabled={isSending || !prompt.trim() || !config.selectedModelId}
						aria-busy={isSending}
					>
						{isSending ? (
							<LoaderCircle size={16} className="animate-spin" />
						) : (
							<ArrowUp size={16} />
						)}
					</Button>
				)}
			/>
		</ReferenceResourceDropSurface>
	)
}
