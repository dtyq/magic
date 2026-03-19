import { useTranslation } from "react-i18next"
import { FileQuestion } from "lucide-react"
import {
	Empty,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
	EmptyDescription,
	EmptyContent,
} from "@/components/shadcn-ui/empty"
import { Button } from "@/components/shadcn-ui/button"
import FileMenuDropdown from "./FileMenuDropdown"
import { PresetFileType } from "../constant"

interface EmptyStateProps {
	onAddFile?: (type: PresetFileType) => void
	onAddDesign?: () => void
	onUploadFile?: () => void
	allowEdit?: boolean
}

function EmptyState({ onAddFile, onAddDesign, onUploadFile, allowEdit = true }: EmptyStateProps) {
	const { t } = useTranslation("super")

	return (
		<Empty className="scrollbar-y-thin scrollbar-thumb-border scrollbar-track-transparent h-full overflow-auto border border-dashed border-border p-6 md:p-6">
			<EmptyHeader>
				<EmptyMedia
					variant="icon"
					className="size-12 border border-border bg-transparent p-2 text-primary"
				>
					<FileQuestion className="size-6" />
				</EmptyMedia>
				<EmptyTitle>{t("topicFiles.emptyState.title")}</EmptyTitle>
				{allowEdit && (
					<EmptyDescription>{t("topicFiles.emptyState.description")}</EmptyDescription>
				)}
			</EmptyHeader>
			{allowEdit && (
				<EmptyContent>
					<div className="flex flex-wrap items-center justify-center gap-3">
						<FileMenuDropdown onAddFile={onAddFile} onAddDesign={onAddDesign}>
							<span>
								<Button>{t("topicFiles.emptyState.createFile")}</Button>
							</span>
						</FileMenuDropdown>
						<Button
							variant="outline"
							className="text-foreground"
							onClick={onUploadFile}
						>
							{t("topicFiles.emptyState.uploadFile")}
						</Button>
					</div>
				</EmptyContent>
			)}
		</Empty>
	)
}

export default EmptyState
