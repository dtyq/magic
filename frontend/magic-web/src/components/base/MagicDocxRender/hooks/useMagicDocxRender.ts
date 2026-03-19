import { useState, useEffect, useCallback, useRef } from "react"
import magicToast from "@/components/base/MagicToaster/utils"
import { useMemoizedFn } from "ahooks"
import { renderAsync } from "docx-preview"
import { logger as Logger } from "@/utils/log"

// Types
import type { MagicDocxRenderProps, DocxRenderState, SectionInfo } from "../types"
import { DocxRenderError } from "../types"

const logger = Logger.createLogger("useMagicDocxRender")

/**
 * useMagicDocxRender - Main logic hook for docx rendering with interactive features
 *
 * @param props - Component props
 * @returns Component state and handlers
 */
export function useMagicDocxRender(props: MagicDocxRenderProps) {
	const {
		file,
		showToolbar = true,
		initialScale = 1.0,
		minScale = 0.3,
		maxScale = 3.0,
		scaleStep = 0.1,
		enableKeyboard = true,
		enableTouchGestures = true,
		autoScale = true,
		onReady,
		onError,
		onLoadingChange,
		onScaleChange,
		renderOptions = {},
	} = props

	// State
	const [state, setState] = useState<DocxRenderState>({
		loading: false,
		error: undefined,
		ready: false,
		scale: initialScale,
		currentSection: 1,
		totalSections: 1,
		isStabilizing: false,
		isAutoScaling: false,
	})

	// Refs
	const containerRef = useRef<HTMLDivElement>(null)
	const viewerRef = useRef<HTMLDivElement>(null)
	const contentRef = useRef<HTMLDivElement>(null)
	const abortControllerRef = useRef<AbortController>()
	const sectionsRef = useRef<SectionInfo[]>([])
	const rafIdRef = useRef<number | null>(null)

	// Update loading state and notify parent
	const updateLoadingState = useMemoizedFn((loading: boolean) => {
		setState((prev) => ({ ...prev, loading }))
		onLoadingChange?.(loading)
	})

	// Update error state and notify parent
	const updateErrorState = useMemoizedFn((error?: DocxRenderError) => {
		setState((prev) => ({ ...prev, error, loading: false }))
		if (error) {
			onError?.(error)
		}
	})

	// Update ready state and notify parent
	const updateReadyState = useMemoizedFn((ready: boolean) => {
		setState((prev) => ({ ...prev, ready }))
		if (ready) {
			onReady?.()
		}
	})

	// Update scale and notify parent
	const updateScale = useMemoizedFn((scale: number) => {
		setState((prev) => ({ ...prev, scale }))
		onScaleChange?.(scale)
	})

	// Set stabilizing period after manual operations
	const setStabilizingPeriod = useMemoizedFn(() => {
		setState((prev) => ({ ...prev, isStabilizing: true }))
		setTimeout(() => {
			setState((prev) => ({ ...prev, isStabilizing: false }))
		}, 400)
	})

	// Convert file to array buffer
	const fileToArrayBuffer = useCallback(async (file: File): Promise<ArrayBuffer> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader()

			reader.onload = () => {
				if (reader.result instanceof ArrayBuffer) {
					resolve(reader.result)
				} else {
					reject(new DocxRenderError("Failed to read file as ArrayBuffer"))
				}
			}

			reader.onerror = () => {
				reject(new DocxRenderError("File reading failed", reader.error || undefined))
			}

			reader.readAsArrayBuffer(file)
		})
	}, [])

	// Analyze document structure and create sections
	const analyzeDocumentStructure = useMemoizedFn(() => {
		if (!contentRef.current) return

		const sections: SectionInfo[] = []
		const container = contentRef.current

		// Find all headings and major sections
		const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6, .docx-wrapper > div")

		headings.forEach((heading, index) => {
			const element = heading as HTMLElement
			sections.push({
				index: index + 1,
				title: element.textContent?.trim() || `Section ${index + 1}`,
				element,
				offsetTop: element.offsetTop,
			})
		})

		// If no headings found, create virtual sections based on content height
		if (sections.length === 0) {
			const containerHeight = container.scrollHeight
			const viewerHeight = viewerRef.current?.clientHeight || 600
			const sectionsCount = Math.max(1, Math.ceil(containerHeight / viewerHeight))

			for (let i = 0; i < sectionsCount; i++) {
				sections.push({
					index: i + 1,
					title: `Section ${i + 1}`,
					element: container,
					offsetTop: i * viewerHeight,
				})
			}
		}

		sectionsRef.current = sections
		setState((prev) => ({ ...prev, totalSections: sections.length }))
	})

	// Update current section based on scroll position
	const updateCurrentSectionFromScroll = useMemoizedFn(() => {
		if (!viewerRef.current || sectionsRef.current.length === 0) return

		const viewer = viewerRef.current
		// Convert scrollTop in viewer (which is applied on scaled content) to content coordinates
		const scaledTop = viewer.scrollTop * state.scale
		const effectiveTop = scaledTop + 160

		let current = 1
		for (const section of sectionsRef.current) {
			if (effectiveTop >= section.offsetTop) current = section.index
			else break
		}

		if (current !== state.currentSection) {
			setState((prev) => ({ ...prev, currentSection: current }))
		}
	})

	// Auto scale to fit container (allow going below minScale for initial fit)
	const applyAutoScale = useMemoizedFn(() => {
		if (!containerRef.current || !contentRef.current) return

		setState((prev) => ({ ...prev, isAutoScaling: true }))

		const container = containerRef.current
		const content = contentRef.current
		const containerWidth = container.clientWidth
		const contentWidth = content.scrollWidth

		// Calculate scale to fit width; allow below minScale here for accurate fit
		const availableWidth = Math.max(0, containerWidth - 40)
		const scaleX = contentWidth > 0 ? availableWidth / contentWidth : 1
		const finalScale = Math.max(0.1, Math.min(maxScale, scaleX))

		updateScale(finalScale)

		setTimeout(() => {
			setState((prev) => ({ ...prev, isAutoScaling: false }))
		}, 300)
	})

	// Render docx content
	const renderDocx = useMemoizedFn(async () => {
		if (!file || !contentRef.current) return

		// Cancel previous render if exists
		if (abortControllerRef.current) {
			abortControllerRef.current.abort()
		}

		// Create new abort controller
		abortControllerRef.current = new AbortController()

		try {
			updateLoadingState(true)
			updateErrorState(undefined)
			updateReadyState(false)

			// Validate file type
			if (!file.name.toLowerCase().endsWith(".docx")) {
				throw new DocxRenderError("Invalid file type. Only .docx files are supported.")
			}

			// Validate file size (max 50MB)
			const maxSize = 50 * 1024 * 1024 // 50MB
			if (file.size > maxSize) {
				throw new DocxRenderError("File too large. Maximum size is 50MB.")
			}

			// Convert file to array buffer
			const arrayBuffer = await fileToArrayBuffer(file)

			// Check if operation was aborted
			if (abortControllerRef.current.signal.aborted) {
				return
			}

			// Clear container
			contentRef.current.innerHTML = ""

			// Render docx
			const defaultOptions = {
				className: "docx-wrapper",
				inWrapper: true,
				ignoreWidth: false,
				ignoreHeight: false,
				ignoreFonts: false,
				breakPages: true,
				ignoreLastRenderedPageBreak: true,
				experimental: false,
				trimXmlDeclaration: true,
				useBase64URL: false,
				useMathMLPolyfill: true,
				renderHeaders: true,
				renderFootnotes: true,
				renderEndnotes: true,
				...renderOptions,
			}

			await renderAsync(arrayBuffer, contentRef.current, undefined, defaultOptions)

			// Check if operation was aborted
			if (abortControllerRef.current.signal.aborted) {
				return
			}

			updateLoadingState(false)
			updateReadyState(true)

			// Analyze document structure and auto scale after DOM paints
			requestAnimationFrame(() => {
				analyzeDocumentStructure()
				if (autoScale) applyAutoScale()
				updateCurrentSectionFromScroll()
			})
		} catch (error) {
			// Don't update state if operation was aborted
			if (abortControllerRef.current?.signal.aborted) {
				return
			}

			logger.error("Docx render error:", error)

			let renderError: DocxRenderError
			if (error instanceof DocxRenderError) {
				renderError = error
			} else if (error instanceof Error) {
				renderError = new DocxRenderError("Failed to render docx file", error)
			} else {
				renderError = new DocxRenderError(
					"Unknown error occurred while rendering docx file",
				)
			}

			updateErrorState(renderError)
		}
	})

	// Zoom in
	const zoomIn = useMemoizedFn(() => {
		const newScale = Math.min(maxScale, state.scale + scaleStep)
		updateScale(newScale)
		setStabilizingPeriod()
	})

	// Zoom out
	const zoomOut = useMemoizedFn(() => {
		const newScale = Math.max(minScale, state.scale - scaleStep)
		updateScale(newScale)
		setStabilizingPeriod()
	})

	// Set zoom scale
	const setZoomScale = useMemoizedFn((scale: number | null) => {
		if (scale && scale >= minScale * 100 && scale <= maxScale * 100) {
			updateScale(scale / 100)
			setStabilizingPeriod()
		}
	})

	// Reset zoom
	const resetZoom = useMemoizedFn(() => {
		updateScale(initialScale)
		setStabilizingPeriod()
	})

	// Go to section
	const goToSection = useMemoizedFn((section: number | null) => {
		if (!section || !viewerRef.current) return

		const sectionInfo = sectionsRef.current.find((s) => s.index === section)
		if (!sectionInfo) return

		const viewer = viewerRef.current
		const targetTop = sectionInfo.offsetTop

		viewer.scrollTo({
			top: (targetTop - 160) / state.scale,
			behavior: "smooth",
		})

		setState((prev) => ({ ...prev, currentSection: section }))
	})

	// Go to previous section
	const goToPrevSection = useMemoizedFn(() => {
		const prevSection = Math.max(1, state.currentSection - 1)
		goToSection(prevSection)
	})

	// Go to next section
	const goToNextSection = useMemoizedFn(() => {
		const nextSection = Math.min(state.totalSections, state.currentSection + 1)
		goToSection(nextSection)
	})

	// Download file
	const downloadFile = useMemoizedFn(() => {
		const url = URL.createObjectURL(file)
		const link = document.createElement("a")
		link.href = url
		link.download = file.name
		link.click()
		URL.revokeObjectURL(url)
		magicToast.success("文件下载成功")
	})

	// Toggle fullscreen
	const toggleFullscreen = useMemoizedFn(() => {
		if (!containerRef.current) return

		if (document.fullscreenElement) {
			document.exitFullscreen()
		} else {
			containerRef.current.requestFullscreen()
		}
	})

	// Reload document
	const reload = useMemoizedFn(() => {
		setState((prev) => ({
			...prev,
			scale: initialScale,
			currentSection: 1,
			totalSections: 1,
		}))
		renderDocx()
	})

	// Effect to render docx when file changes
	useEffect(() => {
		if (file) {
			renderDocx()
		}

		// Cleanup function
		return () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort()
			}
		}
	}, [file, renderDocx])

	// Listen to scroll to update current section
	useEffect(() => {
		const viewer = viewerRef.current
		if (!viewer) return

		const onScroll = () => {
			if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
			rafIdRef.current = requestAnimationFrame(() => {
				updateCurrentSectionFromScroll()
			})
		}

		viewer.addEventListener("scroll", onScroll, { passive: true })
		// Run once to set initial value
		updateCurrentSectionFromScroll()

		return () => {
			viewer.removeEventListener("scroll", onScroll)
			if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
			rafIdRef.current = null
		}
	}, [updateCurrentSectionFromScroll, state.scale])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort()
			}
		}
	}, [])

	return {
		state,
		containerRef,
		viewerRef,
		contentRef,
		handlers: {
			renderDocx,
			zoomIn,
			zoomOut,
			setZoomScale,
			resetZoom,
			goToSection,
			goToPrevSection,
			goToNextSection,
			downloadFile,
			toggleFullscreen,
			reload,
		},
	}
}
