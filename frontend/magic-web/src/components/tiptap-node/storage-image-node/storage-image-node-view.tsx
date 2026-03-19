"use client"

import * as React from "react"
import type { NodeViewProps } from "@tiptap/react"
import { NodeViewWrapper } from "@tiptap/react"
import { revokeImageUrl } from "@/services/tiptap-image-storage"
import type { StorageImageNodeOptions } from "./storage-image-node-extension"
import {
	AlignmentToolbar,
	ImagePlaceholder,
	ResizeHandles,
	ObjectFitToolbar,
} from "@/components/tiptap-node/project-image-node/components"
import {
	useIntersectionObserver,
	useImageResize,
} from "@/components/tiptap-node/project-image-node/hooks"
import "@/components/tiptap-node/storage-image-node/storage-image-node.scss"
import MagicDropdown from "@/components/base/MagicDropdown"

export interface StorageImageNodeViewProps extends NodeViewProps {
	extension: NodeViewProps["extension"] & {
		options: StorageImageNodeOptions
	}
}

/**
 * React component for rendering storage image nodes
 * Implements lazy loading using Intersection Observer
 */
export function StorageImageNodeView(props: StorageImageNodeViewProps) {
	const { node, extension, selected, updateAttributes, editor } = props
	const { imageStorage, onError } = extension.options

	// Check if editor is editable
	const isEditable = editor.isEditable

	const [imageUrl, setImageUrl] = React.useState<string | null>(null)
	const [loading, setLoading] = React.useState(true)
	const [error, setError] = React.useState<Error | null>(null)

	const containerRef = React.useRef<HTMLDivElement>(null)
	const imageRef = React.useRef<HTMLImageElement>(null)
	const aspectRatioRef = React.useRef<number>(1)

	// Use Intersection Observer hook for lazy loading
	const isIntersecting = useIntersectionObserver(containerRef)

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

	// Load image when it becomes visible
	React.useEffect(() => {
		if (!isIntersecting || imageUrl) return

		const loadImage = async () => {
			try {
				setLoading(true)
				setError(null)

				const blob = await imageStorage.getImage(node.attrs.id)

				if (!blob) {
					throw new Error("Image not found in storage")
				}

				const url = URL.createObjectURL(blob)
				setImageUrl(url)
			} catch (err) {
				const errorObj = err instanceof Error ? err : new Error("Failed to load image")
				setError(errorObj)
				onError?.(errorObj)
			} finally {
				setLoading(false)
			}
		}

		loadImage()
	}, [isIntersecting, imageUrl, imageStorage, node.attrs.id, onError])

	// Cleanup object URL on unmount
	React.useEffect(() => {
		return () => {
			if (imageUrl) {
				revokeImageUrl(imageUrl)
			}
		}
	}, [imageUrl])

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

	// Handle retry for failed loads
	const handleRetry = React.useCallback(() => {
		if (error) {
			setError(null)
			setLoading(true)
			// Force reload by setting isIntersecting state
			// The useEffect will automatically retry
			setImageUrl(null)
		}
	}, [error])

	// Handle alignment change
	const handleAlignChange = (align: "left" | "center" | "right") => {
		updateAttributes({ align })
	}

	// Handle objectFit change
	const handleObjectFitChange = (objectFit: "cover" | "contain" | "fill") => {
		updateAttributes({ objectFit })
	}

	// Get alignment class
	const alignClass = node.attrs.align ? `storage-image-node--align-${node.attrs.align}` : ""

	return (
		<NodeViewWrapper
			ref={containerRef}
			className={`storage-image-node ${selected ? "storage-image-node--selected" : ""} ${isResizing ? "storage-image-node--resizing" : ""
				} ${alignClass}`}
		>
			{/* Show loading or error placeholder */}
			<ImagePlaceholder
				loading={loading}
				error={error}
				onRetry={handleRetry}
				isEditable={isEditable}
			/>

			{/* Show image when loaded successfully */}
			{imageUrl && !error && !loading && (
				<MagicDropdown
					open={selected && !isResizing && isEditable}
					placement="top"
					autoAdjustOverflow
					popupRender={() => {
						return (
							<div className="storage-image-node__toolbar-wrapper">
								<AlignmentToolbar
									align={node.attrs.align}
									onAlignChange={handleAlignChange}
								/>
								<div className="storage-image-node__separator" />
								<ObjectFitToolbar
									objectFit={node.attrs.objectFit}
									onObjectFitChange={handleObjectFitChange}
								/>
							</div>
						)
					}}
				>
					<div className="storage-image-node__image-wrapper">
						{/* The actual image element */}
						<img
							ref={imageRef}
							src={imageUrl}
							alt={node.attrs.alt || ""}
							className="storage-image-node__image"
							style={{
								width: dimensions.width ? `${dimensions.width}px` : undefined,
								height: dimensions.height ? `${dimensions.height}px` : undefined,
								objectFit: node.attrs.objectFit,
							}}
							draggable={false}
							onLoad={handleImageLoad}
						/>
						{/* Resize handles - shown when image is selected and editable */}
						<ResizeHandles
							onResizeStart={handleResizeStart}
							visible={selected && !isResizing && isEditable}
						/>
					</div>
				</MagicDropdown>
			)}
		</NodeViewWrapper>
	)
}

export default StorageImageNodeView
