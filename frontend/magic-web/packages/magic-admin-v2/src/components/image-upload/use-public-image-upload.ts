import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import type { UploadedImage } from "@magic-admin-v2/capabilities/types"
import { useUploadPublicImage } from "@magic-admin-v2/hooks/use-upload-public-image"
import { isUploadAbortError } from "./upload-error"

type UsePublicImageUploadOptions = {
	onUploaded: (image: UploadedImage, file: File) => void | Promise<void>
	onUploadingChange?: (uploading: boolean) => void
	onUploadError?: (error: unknown) => void
	onUploadSuccess?: (image: UploadedImage, file: File) => void
	value: string
}

/**
 * Shared state and lifecycle for single public-image uploads.
 * Presentation remains in the field components so product-specific layouts stay unchanged.
 */
export function usePublicImageUpload({
	onUploaded,
	onUploadingChange,
	onUploadError,
	onUploadSuccess,
	value,
}: UsePublicImageUploadOptions) {
	const uploadPublicImage = useUploadPublicImage()
	const inputRef = useRef<HTMLInputElement>(null)
	const controllerRef = useRef<AbortController | null>(null)
	const previewRef = useRef("")
	const mountedRef = useRef(false)
	const uploadingRef = useRef(false)
	const callbacksRef = useRef({
		onUploaded,
		onUploadingChange,
		onUploadError,
		onUploadSuccess,
	})
	const [isUploading, setIsUploading] = useState(false)
	const [localPreview, setLocalPreview] = useState("")
	const [uploadError, setUploadError] = useState<unknown>(null)

	useEffect(() => {
		callbacksRef.current = {
			onUploaded,
			onUploadingChange,
			onUploadError,
			onUploadSuccess,
		}
	}, [onUploaded, onUploadingChange, onUploadError, onUploadSuccess])

	const updateUploading = useCallback((uploading: boolean) => {
		if (uploadingRef.current === uploading) return
		uploadingRef.current = uploading
		if (mountedRef.current) setIsUploading(uploading)
		callbacksRef.current.onUploadingChange?.(uploading)
	}, [])

	const updatePreview = useCallback((nextPreview: string) => {
		if (previewRef.current) URL.revokeObjectURL(previewRef.current)
		previewRef.current = nextPreview
		if (mountedRef.current) setLocalPreview(nextPreview)
	}, [])

	useEffect(() => {
		mountedRef.current = true
		return () => {
			mountedRef.current = false
			controllerRef.current?.abort()
			controllerRef.current = null
			if (previewRef.current) URL.revokeObjectURL(previewRef.current)
			previewRef.current = ""
			if (uploadingRef.current) {
				uploadingRef.current = false
				callbacksRef.current.onUploadingChange?.(false)
			}
		}
	}, [])

	const openFilePicker = useCallback(() => {
		inputRef.current?.click()
	}, [])

	const handleFileChange = useCallback(
		async (event: ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0]
			event.target.value = ""
			if (!file) return

			controllerRef.current?.abort()
			const controller = new AbortController()
			controllerRef.current = controller
			updatePreview(URL.createObjectURL(file))
			setUploadError(null)
			updateUploading(true)

			try {
				const image = await uploadPublicImage(file, { signal: controller.signal })
				if (controllerRef.current !== controller || controller.signal.aborted) return
				await callbacksRef.current.onUploaded(image, file)
				if (controllerRef.current !== controller || controller.signal.aborted) return
				updatePreview("")
				callbacksRef.current.onUploadSuccess?.(image, file)
			} catch (error) {
				if (controllerRef.current !== controller || isUploadAbortError(error)) return
				updatePreview("")
				if (mountedRef.current) setUploadError(error)
				callbacksRef.current.onUploadError?.(error)
			} finally {
				if (controllerRef.current === controller) {
					controllerRef.current = null
					updateUploading(false)
				}
			}
		},
		[updatePreview, updateUploading, uploadPublicImage],
	)

	return {
		handleFileChange,
		inputRef,
		isUploading,
		localPreview,
		openFilePicker,
		previewUrl: localPreview || value.trim(),
		uploadError,
	}
}
