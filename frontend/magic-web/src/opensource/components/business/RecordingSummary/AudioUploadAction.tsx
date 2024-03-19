import { useMemoizedFn } from "ahooks"
import { memo, useCallback, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import UploadAction from "@/opensource/components/base/UploadAction"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/opensource/components/shadcn-ui/tooltip"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

// Common audio file extensions for broad compatibility
const COMMON_AUDIO_EXTENSIONS = [".raw", ".wav", ".mp3", ".ogg", ".webm", ".m4a"]

// Accept all audio MIME types and webm (which might be detected as video/webm on mobile)
const ACCEPT_AUDIO_FORMATS = "audio/*,video/webm,.raw,.wav,.mp3,.ogg,.webm,.m4a"

interface AudioUploadActionProps {
	multiple?: boolean
	maxSize?: number // Maximum file size in bytes (default 500MB)
	handler: (onUpload: () => void) => ReactNode
	onFileChange?: (files: FileList) => void
	onError?: (error: string) => void
}

const AudioUploadAction = memo(
	({
		handler,
		onFileChange,
		multiple = false,
		maxSize = 500 * 1024 * 1024, // 500MB default
		onError,
	}: AudioUploadActionProps) => {
		const { t } = useTranslation("super")

		const validateAudioFile = useCallback(
			(file: File): boolean => {
				const fileName = file.name.toLowerCase()
				const fileExtension = `.${fileName.split(".").pop()}`

				// Check file size first (most important constraint)
				if (file.size > maxSize) {
					const maxSizeMB = Math.round(maxSize / (1024 * 1024))
					const errorMsg = t("recordingSummary.audioUpload.error.fileTooLarge", {
						maxSize: maxSizeMB,
						defaultValue: `File size exceeds ${maxSizeMB}MB limit`,
					})
					magicToast.error(errorMsg)
					onError?.(errorMsg)
					return false
				}

				// Relaxed audio file validation - accept if any of these conditions are met:
				const isLikelyAudioFile = (() => {
					// 1. MIME type starts with "audio/"
					if (file.type && file.type.startsWith("audio/")) {
						return true
					}

					// 2. MIME type is video/webm (could be audio-only webm)
					if (file.type === "video/webm") {
						return true
					}

					// 3. Common audio file extensions
					if (COMMON_AUDIO_EXTENSIONS.includes(fileExtension)) {
						return true
					}

					// 4. Some video formats that commonly contain audio
					const audioCompatibleVideoExtensions = [".mp4", ".mov", ".3gp", ".mkv", ".avi"]
					if (audioCompatibleVideoExtensions.includes(fileExtension)) {
						return true
					}

					// 5. No MIME type set but has audio extension (common on mobile devices)
					if (!file.type && COMMON_AUDIO_EXTENSIONS.includes(fileExtension)) {
						return true
					}

					return false
				})()

				if (!isLikelyAudioFile) {
					const errorMsg = t("recordingSummary.audioUpload.error.notAudioFile", {
						defaultValue:
							"Selected file doesn't appear to be an audio file. Please select a valid audio file.",
					})
					magicToast.error(errorMsg)
					onError?.(errorMsg)
					return false
				}

				return true
			},
			[maxSize, onError, t],
		)

		const handleFileChange = useMemoizedFn((files: FileList) => {
			const validFiles: File[] = []

			// Validate each file
			for (let i = 0; i < files.length; i++) {
				const file = files[i]
				if (validateAudioFile(file)) {
					validFiles.push(file)
				}
			}

			// If no valid files, return early
			if (validFiles.length === 0) {
				return
			}

			// If some files were invalid, show warning
			if (validFiles.length !== files.length) {
				const warningMsg = t("recordingSummary.audioUpload.warning.someFilesSkipped", {
					validCount: validFiles.length,
					totalCount: files.length,
					defaultValue: `${validFiles.length} of ${files.length} files are valid and will be uploaded`,
				})
				magicToast.warning(warningMsg)
			}

			// Create a new FileList with valid files
			const dt = new DataTransfer()
			validFiles.forEach((file) => dt.items.add(file))

			onFileChange?.(dt.files)
		})

		// Create tooltip content with supported formats and file size limit
		const tooltipTitle = t("recordingSummary.audioUpload.tooltip.supportedFormats", {
			formats: COMMON_AUDIO_EXTENSIONS.map((s) => s.slice(1)).join("/"),
			maxSize: Math.round(maxSize / (1024 * 1024)),
			defaultValue: `Supports all audio formats including: ${COMMON_AUDIO_EXTENSIONS.slice(
				0,
				8,
			).join(", ")}... (Max: ${Math.round(maxSize / (1024 * 1024))}MB)`,
		})

		// Wrapped handler with tooltip
		const wrappedHandler = useCallback(
			(onUpload: () => void) => (
				<Tooltip>
					<TooltipTrigger asChild>{handler(onUpload)}</TooltipTrigger>
					<TooltipContent side="top">{tooltipTitle}</TooltipContent>
				</Tooltip>
			),
			[handler, tooltipTitle],
		)

		return (
			<UploadAction
				multiple={multiple}
				accept={ACCEPT_AUDIO_FORMATS}
				handler={wrappedHandler}
				onFileChange={handleFileChange}
			/>
		)
	},
)

AudioUploadAction.displayName = "AudioUploadAction"

export default AudioUploadAction
export { COMMON_AUDIO_EXTENSIONS }
