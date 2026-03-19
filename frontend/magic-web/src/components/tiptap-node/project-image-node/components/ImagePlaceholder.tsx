import { IconPhotoUp } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import LoadingIcon from "@/components/business/RecordingSummary/components/LoadingIcon"

/**
 * Props for ImagePlaceholder component
 */
interface ImagePlaceholderProps {
	/** Whether the image is currently uploading */
	uploading?: boolean
	/** Upload progress percentage (0-100) */
	uploadProgress?: number
	/** Upload error message */
	uploadError?: string | null
	/** Whether the image is loading */
	loading?: boolean
	/** Load error object */
	error?: Error | null
	/** Callback when retry button is clicked */
	onRetry?: () => void
	/** Whether the editor is editable (controls retry button visibility) */
	isEditable?: boolean
}

/**
 * ImagePlaceholder component displays loading and error states for images
 * Shows appropriate UI for uploading, loading, and error conditions
 */
export function ImagePlaceholder({
	uploading,
	uploadProgress,
	uploadError,
	loading,
	error,
	onRetry,
	isEditable = true,
}: ImagePlaceholderProps) {
	const { t } = useTranslation()

	// Show loading state
	if (uploading && !uploadError && !error) {
		return (
			<div className="project-image-node__placeholder project-image-node__placeholder--loading">
				<IconPhotoUp
					size={172}
					stroke={1.5}
					color="currentColor"
					className="project-image-node__icon"
				/>
				<div className="project-image-node__upload-icon-wrapper">
					{(uploading || loading) && <LoadingIcon color="currentColor" size={16} />}
				</div>
				<span className="project-image-node__progress-text">
					{uploading
						? uploadProgress && uploadProgress > 0
							? t("tiptap:projectImage.upload.uploadingProgress", {
								progress: uploadProgress,
							})
							: t("tiptap:projectImage.upload.uploading")
						: t("tiptap:projectImage.placeholder.loading")}
				</span>
			</div>
		)
	}

	// Show error state
	if (uploadError || error) {
		return (
			<div className="project-image-node__placeholder project-image-node__placeholder--error">
				<IconPhotoUp
					size={172}
					stroke={1.5}
					color="currentColor"
					className="project-image-node__icon"
				/>
				<div className="project-image-node__error-content">
					<span className="project-image-node__error-title">
						{uploadError
							? t("tiptap:projectImage.upload.errorTitle")
							: t("tiptap:projectImage.load.errorTitle")}
					</span>
					{isEditable && (
						<button
							type="button"
							className="project-image-node__retry-button"
							onClick={onRetry}
						>
							{t("tiptap:projectImage.actions.retry")}
						</button>
					)}
				</div>
			</div>
		)
	}

	return null
}
