import { Upload } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

interface VideoInputEditorProps {
	/** Override placeholder from skill config (resolved string) */
	placeholder?: string
	onVideoSubmit?: (videoUrl: string) => void
	onFileUpload?: (file: File) => void
}

function VideoInputEditor({ placeholder, onVideoSubmit, onFileUpload }: VideoInputEditorProps) {
	const { t } = useTranslation("super/mainInput")
	const resolvedPlaceholder = placeholder ?? t("videoInputEditor.placeholder")
	const [videoUrl, setVideoUrl] = useState("")

	function handleSubmit() {
		if (videoUrl.trim()) {
			onVideoSubmit?.(videoUrl)
			setVideoUrl("")
		}
	}

	function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0]
		if (file) {
			onFileUpload?.(file)
		}
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			handleSubmit()
		}
	}

	return (
		<div className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background p-4">
			<input
				type="text"
				value={videoUrl}
				onChange={(e) => setVideoUrl(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={resolvedPlaceholder}
				className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
			/>
			<span className="text-sm text-muted-foreground">{t("videoInputEditor.or")}</span>
			<label className="flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
				<Upload className="h-4 w-4" />
				{t("videoInputEditor.upload")}
				<input
					type="file"
					accept="video/*"
					onChange={handleFileUpload}
					className="hidden"
				/>
			</label>
		</div>
	)
}

export default VideoInputEditor
