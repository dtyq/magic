// @ts-ignore
import ReplayIcon from "@/opensource/pages/share/assets/icon/replay_icon.svg"
// @ts-ignore
import FolderIcon from "@/opensource/pages/share/assets/icon/folder_empty.svg"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { useTranslation } from "react-i18next"

interface ErrorDisplayProps {
	errorMessage?: string
	onRetry?: () => void
	isFileShare?: boolean
}

export default function ErrorDisplay({
	errorMessage,
	onRetry,
	isFileShare = false,
}: ErrorDisplayProps) {
	const { t } = useTranslation("super")

	const description = isFileShare
		? t("share.errorDisplay.fileDescription")
		: t("share.errorDisplay.replayDescription")

	// 根据分享类型选择图标
	const icon = isFileShare ? FolderIcon : ReplayIcon

	return (
		<div
			className="flex h-full w-full select-none items-center justify-center"
			data-testid="error-display"
		>
			<div className="flex h-[200px] w-[266px] flex-col items-center justify-center rounded-md">
				<div className="pb-5 text-muted-foreground" data-testid="error-display-icon">
					<img src={icon} alt="" />
				</div>
				<div
					className="text-center text-[32px] font-semibold text-muted-foreground"
					data-testid="error-display-message"
				>
					{errorMessage || t("share.noPermissionToView")}
				</div>
				<span
					className="mb-5 mt-1 text-center text-sm font-normal text-muted-foreground"
					data-testid="error-display-description"
				>
					{description}
				</span>
				{onRetry && (
					<Button
						type="button"
						variant="default"
						size="sm"
						onClick={() => {
							window.location.href = window.location.origin
						}}
						data-testid="error-display-retry-button"
					>
						{t("common.back")}
					</Button>
				)}
			</div>
		</div>
	)
}
