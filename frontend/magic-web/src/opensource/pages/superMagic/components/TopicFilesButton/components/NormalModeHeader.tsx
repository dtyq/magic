import {
	Search,
	RefreshCw,
	Loader2,
	FilePlus,
	FolderPlus,
	Upload,
	SquareCheckBig,
} from "lucide-react"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import MagicTooltip from "@/opensource/components/base/MagicTooltip"
import { useIsMobile } from "@/opensource/hooks/use-mobile"
import FileMenuDropdown from "./FileMenuDropdown"
import UploadMenuDropdown from "./UploadMenuDropdown"
import { type PresetFileType } from "../constant"
import { cn } from "@/opensource/lib/utils"

interface NormalModeHeaderProps {
	isShareRoute: boolean
	refreshLoading: boolean
	allowEdit: boolean
	onRefresh: () => void
	onSearch?: () => void
	onAddFile?: (extraType?: PresetFileType) => void
	onAddDesign?: () => void
	onAddFolder?: () => void
	onUploadFile?: () => void
	onUploadFolder?: () => void
	onEnterSelectMode?: () => void
	className?: string
}

function NormalModeHeader({
	isShareRoute,
	refreshLoading,
	allowEdit,
	onRefresh,
	onSearch,
	onAddFile,
	onAddDesign,
	onAddFolder,
	onUploadFile,
	onUploadFolder,
	onEnterSelectMode,
	className,
}: NormalModeHeaderProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()

	return (
		<div className={cn("flex h-8 w-full items-center justify-between pl-4 pr-2", className)}>
			<p className="whitespace-nowrap text-xs font-normal leading-4 text-foreground">
				{t("topicFiles.title")}
			</p>
			<div className="flex items-center gap-1">
				{allowEdit && onSearch && (
					<MagicTooltip title={t("topicFiles.search")}>
						<button
							className="flex h-6 w-6 items-center justify-center rounded-md bg-transparent transition-colors hover:bg-accent"
							type="button"
							onClick={onSearch}
							aria-label={t("topicFiles.search")}
						>
							<Search size={16} className="text-foreground" />
						</button>
					</MagicTooltip>
				)}
				{allowEdit && onAddFile && !isMobile && (
					<FileMenuDropdown onAddFile={onAddFile} onAddDesign={onAddDesign}>
						<span>
							<MagicTooltip title={t("topicFiles.addFile")}>
								<button
									className="flex h-6 w-6 items-center justify-center rounded-md bg-transparent transition-colors hover:bg-accent"
									type="button"
									aria-label={t("topicFiles.addFile")}
								>
									<FilePlus size={16} className="text-foreground" />
								</button>
							</MagicTooltip>
						</span>
					</FileMenuDropdown>
				)}
				{allowEdit && onAddFolder && !isMobile && (
					<MagicTooltip title={t("topicFiles.addFolder")}>
						<button
							className="flex h-6 w-6 items-center justify-center rounded-md bg-transparent transition-colors hover:bg-accent"
							type="button"
							onClick={onAddFolder}
							aria-label={t("topicFiles.addFolder")}
						>
							<FolderPlus size={16} className="text-foreground" />
						</button>
					</MagicTooltip>
				)}
				{allowEdit && (onUploadFile || onUploadFolder) && !isMobile && (
					<UploadMenuDropdown onUploadFile={onUploadFile} onUploadFolder={onUploadFolder}>
						<span>
							<MagicTooltip title={t("topicFiles.upload")}>
								<button
									className="flex h-6 w-6 items-center justify-center rounded-md bg-transparent transition-colors hover:bg-accent"
									type="button"
									aria-label={t("topicFiles.upload")}
								>
									<Upload size={16} className="text-foreground" />
								</button>
							</MagicTooltip>
						</span>
					</UploadMenuDropdown>
				)}
				{!isShareRoute && (
					<MagicTooltip title={t("topicFiles.refreshList")}>
						<button
							className="flex h-6 w-6 items-center justify-center rounded-md bg-transparent transition-colors hover:bg-accent"
							type="button"
							onClick={onRefresh}
							aria-label={t("topicFiles.refreshList")}
							disabled={refreshLoading}
						>
							{refreshLoading ? (
								<Loader2 size={16} className="animate-spin text-foreground" />
							) : (
								<RefreshCw size={16} className="text-foreground" />
							)}
						</button>
					</MagicTooltip>
				)}
				{allowEdit && onEnterSelectMode && (
					<MagicTooltip title={t("topicFiles.selectFiles")}>
						<button
							className="flex h-6 w-6 items-center justify-center rounded-md bg-transparent transition-colors hover:bg-accent"
							type="button"
							onClick={onEnterSelectMode}
							aria-label={t("topicFiles.selectFiles")}
						>
							<SquareCheckBig size={16} className="text-foreground" />
						</button>
					</MagicTooltip>
				)}
			</div>
		</div>
	)
}

export default memo(NormalModeHeader)
