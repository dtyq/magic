import React from "react"
import { useTranslation } from "react-i18next"
import MagicFileIcon from "@/opensource/components/base/MagicFileIcon"
import { cn } from "@/opensource/lib/utils"
import FileError from "@/opensource/pages/superMagic/assets/svg/file_error.svg"

interface DeletedProps {
	data: {
		file_id: string
		file_name: string
		file_extension?: string
		updated_at?: string
		content?: null
	}
	showHeader?: boolean
}

const Deleted: React.FC<DeletedProps> = ({ data, showHeader = true }) => {
	const { t } = useTranslation("super")

	const { file_name, file_extension } = data

	return (
		<div className={cn("flex h-full w-full flex-col bg-background")}>
			{/* File Header */}
			{showHeader && (
				<div
					className={cn(
						"flex h-11 items-center gap-1 border-b border-border bg-background px-2.5 py-2.5",
					)}
				>
					<MagicFileIcon type={file_extension || ""} size={20} className="shrink-0" />
					<span
						className={cn(
							"overflow-hidden text-ellipsis whitespace-nowrap text-sm font-normal leading-5 text-destructive line-through",
						)}
					>
						{file_name}
					</span>
					<span className={cn("shrink-0 text-sm font-normal leading-5 text-destructive")}>
						{t("deletedFile.status")}
					</span>
				</div>
			)}

			{/* Content Area */}
			<div
				className={cn(
					"flex flex-1 flex-col items-center justify-center bg-background px-5 py-[60px]",
				)}
			>
				{/* Error Icon */}
				<div className="mb-1">
					<img src={FileError} alt="" />
				</div>

				{/* Message */}
				<div className={cn("text-center text-sm leading-5 text-muted-foreground")}>
					{t("deletedFile.message")}
				</div>
			</div>
		</div>
	)
}

export default Deleted
