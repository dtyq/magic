import * as React from "react"
import { IconLink, IconCheck, IconX } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import MagicDropdown from "@/components/base/MagicDropdown"

/**
 * Props for ImageUrlEditor component
 */
interface ImageUrlEditorProps {
	/** Current image URL */
	currentUrl: string
	/** Callback when URL changes */
	onUrlChange: (url: string) => void
	/** Whether the editor should be visible */
	visible?: boolean
}

/**
 * ImageUrlEditor component for changing image URL
 * Displays a button that opens an inline input field
 */
export function ImageUrlEditor({ currentUrl, onUrlChange, visible = true }: ImageUrlEditorProps) {
	const { t } = useTranslation("tiptap")
	const [isEditing, setIsEditing] = React.useState(false)
	const [inputValue, setInputValue] = React.useState(currentUrl)
	const inputRef = React.useRef<HTMLInputElement>(null)

	// Update input value when current URL changes
	React.useEffect(() => {
		setInputValue(currentUrl)
	}, [currentUrl])

	// Focus input when entering edit mode
	React.useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus()
			inputRef.current.select()
		}
	}, [isEditing])

	if (!visible) return null

	// Handle save URL
	const handleSave = () => {
		const trimmedUrl = inputValue.trim()
		if (trimmedUrl && trimmedUrl !== currentUrl) {
			onUrlChange(trimmedUrl)
		}
		setIsEditing(false)
	}

	// Handle cancel
	const handleCancel = () => {
		setInputValue(currentUrl)
		setIsEditing(false)
	}

	// Handle key press
	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault()
			handleSave()
		} else if (e.key === "Escape") {
			e.preventDefault()
			handleCancel()
		}
	}

	return (
		<MagicDropdown
			trigger={["click"]}
			open={isEditing}
			onOpenChange={setIsEditing}
			placement="top"
			popupRender={() => {
				return (
					<div className="project-image-node__url-editor">
						<input
							ref={inputRef}
							type="text"
							className="project-image-node__url-input"
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder={t("projectImage.url.placeholder")}
							aria-label={t("projectImage.url.ariaLabel")}
						/>
						<button
							type="button"
							className="project-image-node__url-action-button project-image-node__url-action-button--confirm"
							onClick={handleSave}
							aria-label={t("projectImage.url.confirm")}
							title={t("projectImage.url.confirm")}
						>
							<IconCheck size={16} />
						</button>
						<button
							type="button"
							className="project-image-node__url-action-button project-image-node__url-action-button--cancel"
							onClick={handleCancel}
							aria-label={t("projectImage.url.cancel")}
							title={t("projectImage.url.cancel")}
						>
							<IconX size={16} />
						</button>
					</div>
				)
			}}
		>
			<button
				type="button"
				className="project-image-node__alignment-button"
				onClick={() => setIsEditing(true)}
				aria-label={t("projectImage.url.edit")}
				title={t("projectImage.url.edit")}
			>
				<IconLink size={16} />
			</button>
		</MagicDropdown>
	)
}
