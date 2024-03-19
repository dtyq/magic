"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import type { NodeViewProps } from "@tiptap/react"
import { NodeViewWrapper } from "@tiptap/react"
import type { ProjectImageNodeOptions } from "./project-image-node-extension"
import { isTempPath } from "./temp-path-utils"
import { AlignmentToolbar, ImagePlaceholder, ImageUrlEditor, ResizeHandles } from "./components"
import { useIntersectionObserver, useImageLoader, useImageResize } from "./hooks"
import "@/opensource/components/tiptap-node/project-image-node/project-image-node.scss"

/**
 * Props interface for ProjectImageNodeView
 */
export interface ProjectImageNodeViewProps extends NodeViewProps {
	extension: NodeViewProps["extension"] & {
		options: ProjectImageNodeOptions
	}
}

/**
 * React component for rendering project image nodes
 * Handles lazy loading, resizing, alignment, and upload states
 * Uses Intersection Observer for efficient lazy loading
 */
export function ProjectImageNodeView(props: ProjectImageNodeViewProps) {
	const { node, extension, selected, updateAttributes, editor } = props
	const { urlResolver, onError } = extension.options

	// Extract upload status from node attributes
	const { uploading, uploadProgress, uploadError } = node.attrs

	// Check if editor is editable
	const [isEditable, setIsEditable] = React.useState(editor.isEditable)

	React.useEffect(() => {
		if (!editor) return

		const handleUpdate = () => {
			setIsEditable(editor.isEditable)
		}
		editor.on("update", handleUpdate)
		return () => {
			editor.off("update", handleUpdate)
		}
	}, [editor])

	const containerRef = React.useRef<HTMLDivElement>(null)
	const imageRef = React.useRef<HTMLImageElement>(null)
	const aspectRatioRef = React.useRef<number>(1)

	// Track toolbar position for portal rendering
	const [toolbarPosition, setToolbarPosition] = React.useState<{
		top: number
		left: number
	} | null>(null)

	// Use Intersection Observer hook for lazy loading
	const isIntersecting = useIntersectionObserver(containerRef)

	// Use image loader hook with retry mechanism
	const shouldLoad = !uploading && !uploadError && Boolean(node.attrs.src) && isIntersecting
	const {
		imageUrl,
		loading,
		error,
		retry: retryImageLoad,
		handleImageError,
	} = useImageLoader({
		src: node.attrs.src,
		shouldLoad,
		urlResolver,
		onError,
	})

	// const error = true

	// Use image resize hook
	const { dimensions, isResizing, handleResizeStart, setDimensions } = useImageResize({
		initialDimensions: {
			width: node.attrs.width,
			height: node.attrs.height,
		},
		aspectRatioRef,
		onResizeComplete: (newDimensions) => {
			updateAttributes({
				width: newDimensions.width,
				height: newDimensions.height,
			})
		},
	})

	// Update toolbar position when image is selected
	React.useEffect(() => {
		if (selected && !isResizing && isEditable && containerRef.current) {
			const updatePosition = () => {
				const rect = containerRef.current?.getBoundingClientRect()
				if (rect) {
					setToolbarPosition({
						top: rect.top + window.scrollY - 50,
						left: rect.left + rect.width / 2 + window.scrollX,
					})
				}
			}

			updatePosition()

			// Update position on scroll or resize
			window.addEventListener("scroll", updatePosition, true)
			window.addEventListener("resize", updatePosition)

			return () => {
				window.removeEventListener("scroll", updatePosition, true)
				window.removeEventListener("resize", updatePosition)
			}
		} else {
			setToolbarPosition(null)
		}
	}, [selected, isResizing, isEditable])

	// Calculate aspect ratio when image loads
	const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
		const img = e.currentTarget
		aspectRatioRef.current = img.naturalWidth / img.naturalHeight

		// If no dimensions are set, use natural dimensions
		if (!dimensions.width && !dimensions.height) {
			const parentElement = containerRef.current?.parentElement
			if (parentElement) {
				const parentWidth = parentElement.offsetWidth
				const currentHeight = parentWidth / aspectRatioRef.current
				setDimensions({
					width: parentWidth,
					height: currentHeight,
				})
			} else {
				setDimensions({
					width: img.naturalWidth,
					height: img.naturalHeight,
				})
			}
		}
	}

	/**
	 * Handle retry for failed uploads or loads
	 * Attempts to re-upload or reload the image
	 */
	const handleRetry = React.useCallback(() => {
		const src = node.attrs.src

		// If it's an upload error with temp path, retry upload
		if (uploadError && isTempPath(src)) {
			const saveImageExtension = editor.extensionManager.extensions.find(
				(ext) => ext.name === "saveImageToProject",
			)

			if (saveImageExtension?.storage?.retryUpload) {
				saveImageExtension.storage.retryUpload(src, editor.view).catch((err: Error) => {
					onError?.(err)
				})
			}
		}
		// If it's a load error, retry loading
		else if (error) {
			retryImageLoad()
		}
	}, [uploadError, error, node.attrs.src, editor, onError, retryImageLoad])

	// Handle alignment change
	const handleAlignChange = (align: "left" | "center" | "right") => {
		updateAttributes({ align })
	}

	// Handle URL change
	const handleUrlChange = (newUrl: string) => {
		updateAttributes({ src: newUrl })
	}

	// Get alignment class
	const alignClass = node.attrs.align ? `project-image-node--align-${node.attrs.align}` : ""

	// Render toolbar using portal
	const renderToolbar = () => {
		if (!toolbarPosition) return null

		return createPortal(
			<div
				className="project-image-node__toolbar-wrapper"
				style={{
					position: "fixed",
					top: `${toolbarPosition.top}px`,
					left: `${toolbarPosition.left}px`,
					transform: "translateX(-50%)",
					zIndex: 100,
					pointerEvents: "auto",
				}}
				// Prevent clicks from deselecting the node
				onMouseDown={(e) => e.preventDefault()}
			>
				<AlignmentToolbar align={node.attrs.align} onAlignChange={handleAlignChange} />
				<div className="project-image-node__separator" />
				<ImageUrlEditor currentUrl={node.attrs.src} onUrlChange={handleUrlChange} />
			</div>,
			document.body,
		)
	}

	return (
		<>
			<NodeViewWrapper
				ref={containerRef}
				className={`project-image-node ${
					selected && isEditable ? "project-image-node--selected" : ""
				} ${isResizing ? "project-image-node--resizing" : ""} ${alignClass}`}
			>
				{/* Show loading or error placeholder */}
				<ImagePlaceholder
					uploading={uploading}
					uploadProgress={uploadProgress}
					uploadError={uploadError}
					loading={loading}
					error={error}
					onRetry={handleRetry}
					isEditable={isEditable}
				/>
				{/* Show URL editor when image is selected and editable */}
				{error && isEditable && (
					<div className="project-image-node__toolbar-wrapper">
						<ImageUrlEditor currentUrl={node.attrs.src} onUrlChange={handleUrlChange} />
					</div>
				)}
				{/* Show image when loaded successfully */}
				{imageUrl &&
					!isTempPath(imageUrl) &&
					!error &&
					!uploadError &&
					!(uploading || loading) && (
						<div
							className="project-image-node__image-wrapper"
							style={{ position: "relative" }}
						>
							{/* The actual image element */}
							<img
								ref={imageRef}
								src={imageUrl}
								alt={node.attrs.alt || node.attrs.file_name || ""}
								className="project-image-node__image"
								style={{
									width: dimensions.width ? `${dimensions.width}px` : undefined,
									maxHeight: dimensions.height
										? `${dimensions.height}px`
										: undefined,
									objectFit: node.attrs.objectFit,
								}}
								draggable={false}
								onLoad={handleImageLoad}
								onError={handleImageError}
							/>
							{/* Resize handles - shown when image is selected and editable */}
							<ResizeHandles
								onResizeStart={handleResizeStart}
								visible={selected && !isResizing && isEditable}
							/>
						</div>
					)}
			</NodeViewWrapper>
			{/* Render toolbar via portal to escape stacking context */}
			{renderToolbar()}
		</>
	)
}

export default ProjectImageNodeView
