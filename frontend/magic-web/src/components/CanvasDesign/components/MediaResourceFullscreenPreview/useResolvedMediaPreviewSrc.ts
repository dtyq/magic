import { useCallback, useEffect, useState } from "react"
import { useCanvas } from "../../context/CanvasContext"

interface ResolvedMediaPreviewSrcResult {
	src: string | undefined
	isLoading: boolean
	hasError: boolean
}

export function useResolvedVideoPreviewSrc(path: string): ResolvedMediaPreviewSrcResult {
	const { canvas } = useCanvas()
	const [src, setSrc] = useState<string | undefined>(undefined)
	const [isLoading, setIsLoading] = useState(false)
	const [hasError, setHasError] = useState(false)

	useEffect(() => {
		if (!canvas || !path) {
			setSrc(undefined)
			setIsLoading(false)
			setHasError(false)
			return
		}

		let cancelled = false
		setIsLoading(true)
		setHasError(false)

		void (async () => {
			try {
				const resource = await canvas.videoResourceManager.getResource(path)
				if (cancelled) return
				setSrc(resource?.ossSrc ?? undefined)
				setHasError(!resource?.ossSrc)
			} catch {
				if (cancelled) return
				setSrc(undefined)
				setHasError(true)
			} finally {
				if (!cancelled) {
					setIsLoading(false)
				}
			}
		})()

		return () => {
			cancelled = true
		}
	}, [canvas, path])

	return {
		src,
		isLoading,
		hasError,
	}
}

export function useResolvedFilePreviewSrc(path: string): ResolvedMediaPreviewSrcResult {
	const { canvas } = useCanvas()
	const [src, setSrc] = useState<string | undefined>(undefined)
	const [isLoading, setIsLoading] = useState(false)
	const [hasError, setHasError] = useState(false)

	const resolveSrc = useCallback(async () => {
		if (!path) {
			setSrc(undefined)
			setIsLoading(false)
			setHasError(false)
			return
		}

		const getFileInfo = canvas?.magicConfigManager.config?.methods?.getFileInfo
		if (!getFileInfo) {
			setSrc(path)
			setIsLoading(false)
			setHasError(false)
			return
		}

		setIsLoading(true)
		setHasError(false)
		try {
			const fileInfo = await getFileInfo(path, { useImageProcess: false })
			setSrc(fileInfo?.src || undefined)
			setHasError(!fileInfo?.src)
		} catch {
			setSrc(undefined)
			setHasError(true)
		} finally {
			setIsLoading(false)
		}
	}, [canvas, path])

	useEffect(() => {
		void resolveSrc()
	}, [resolveSrc])

	return {
		src,
		isLoading,
		hasError,
	}
}
