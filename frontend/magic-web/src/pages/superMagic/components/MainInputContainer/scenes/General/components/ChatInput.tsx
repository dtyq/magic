import { AtSign, Sparkles, ChevronsUpDown, Globe, Plug, Upload, Mic, ArrowUp } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Separator } from "@/components/shadcn-ui/separator"

interface ChatInputProps {
	placeholder?: string
	helpText?: string
	onMentionClick?: () => void
	onModelSwitchClick?: () => void
	onInternetSearchClick?: () => void
	onPluginsClick?: () => void
	onUploadClick?: () => void
	onVoiceInputClick?: () => void
	onSendClick?: () => void
}

function ChatInput({
	placeholder,
	helpText,
	onMentionClick,
	onModelSwitchClick,
	onInternetSearchClick,
	onPluginsClick,
	onUploadClick,
	onVoiceInputClick,
	onSendClick,
}: ChatInputProps) {
	const { t } = useTranslation("super/mainInput")
	const finalPlaceholder = placeholder ?? t("chatInput.placeholder")
	const finalHelpText = helpText ?? t("chatInput.helpText")
	return (
		<div className="shadow-xs w-full rounded-xl border border-border bg-background p-2.5">
			{/* Top Action Group - @ mention button */}
			<div className="mb-2 flex w-full flex-wrap items-center gap-2">
				<Button
					variant="outline"
					size="icon-sm"
					className="size-6 p-1"
					onClick={onMentionClick}
				>
					<AtSign className="size-4" />
				</Button>
			</div>

			{/* Text Container - Placeholder text area */}
			<div className="mb-2 flex min-h-16 w-full flex-col gap-0.5 overflow-clip">
				<div className="flex w-full items-center gap-1.5">
					<p className="grow text-sm leading-5 text-muted-foreground">
						{finalPlaceholder}
					</p>
				</div>
				<div className="flex w-full items-center">
					<p className="text-sm leading-5 text-muted-foreground">{finalHelpText}</p>
				</div>
			</div>

			{/* Actions Container - Bottom toolbar */}
			<div className="flex w-full items-start justify-between">
				{/* Model Selector */}
				<div className="w-[132px]">
					<Button
						variant="secondary"
						size="sm"
						className="h-8 w-full justify-start gap-1.5 px-2"
						onClick={onModelSwitchClick}
					>
						<Sparkles className="size-4" />
						<span className="text-sm">{t("chatInput.model")}</span>
						{/* Model Icons */}
						<div className="flex items-center gap-0.5">
							{/* Max Model Icon */}
							<div
								className="size-4 rounded"
								style={{
									backgroundImage:
										"linear-gradient(149.057deg, rgb(38, 31, 70) 33.301%, rgb(36, 26, 214) 66.065%, rgb(165, 23, 253) 100%)",
								}}
							/>
							{/* Nano Banana Icon */}
							<div className="size-4 rounded bg-[#ffdb0f]" />
						</div>
						<ChevronsUpDown className="size-4" />
					</Button>
				</div>

				{/* Actions Bar - Right side buttons */}
				<div className="flex items-center gap-1">
					{/* Primary Actions Group */}
					<div className="flex items-center gap-1">
						<Button
							variant="secondary"
							size="icon-sm"
							className="h-8 opacity-60"
							onClick={onInternetSearchClick}
						>
							<Globe className="size-4" />
						</Button>
						<Button
							variant="secondary"
							size="icon-sm"
							className="h-8"
							onClick={onPluginsClick}
						>
							<Plug className="size-4" />
						</Button>
						<Button
							variant="secondary"
							size="icon-sm"
							className="h-8"
							onClick={onUploadClick}
						>
							<Upload className="size-4" />
						</Button>
					</div>

					{/* Divider */}
					<div className="flex h-4 w-0 items-center justify-center">
						<Separator orientation="vertical" className="h-4" />
					</div>

					{/* Secondary Actions Group */}
					<div className="flex items-center gap-1">
						<Button
							variant="secondary"
							size="icon-sm"
							className="size-8"
							onClick={onVoiceInputClick}
						>
							<Mic className="size-4" />
						</Button>
						<Button
							variant="default"
							size="icon-sm"
							className="size-8 bg-foreground opacity-50"
							onClick={onSendClick}
						>
							<ArrowUp className="size-4 text-sidebar" />
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}

export default ChatInput
