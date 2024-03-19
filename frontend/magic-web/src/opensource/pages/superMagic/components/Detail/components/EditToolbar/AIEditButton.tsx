import { memo, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Sparkles, ChevronDown } from "lucide-react"
import { Button } from "@/opensource/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/opensource/components/shadcn-ui/dropdown-menu"
import { HTMLGuideTourElementId } from "@/opensource/pages/superMagic/hooks/useHTMLGuideTour"
import { useAIEdit } from "@/opensource/pages/superMagic/components/Detail/components/PPTRender/hooks/useAIEdit"
import { cn } from "@/opensource/lib/utils"
import ConditionalTooltip from "./ConditionalTooltip"
import { TOOLBAR_Z_INDEX } from "../../constants/z-index"

interface AIEditButtonProps {
	/** 是否显示按钮文字 */
	showButtonText?: boolean
	/** 附件列表（用于AI编辑） */
	attachmentList?: any[]
	/** 当前文件ID */
	fileId?: string
}

function AIEditButton({ showButtonText = false, attachmentList, fileId }: AIEditButtonProps) {
	const { t } = useTranslation("super")
	const [dropdownOpen, setDropdownOpen] = useState(false)

	// Find current file from attachmentList
	const currentFile = useMemo(() => {
		return attachmentList?.find((item: any) => item.file_id === fileId)
	}, [attachmentList, fileId])

	// Use AI edit hook
	const { aiEditItems } = useAIEdit({
		currentFile,
		onActionComplete: () => setDropdownOpen(false),
	})

	return (
		<DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
			<DropdownMenuTrigger asChild>
				<span>
					<ConditionalTooltip
						showText={showButtonText}
						title={t("topicFiles.AIOptimization")}
					>
						<Button
							size="sm"
							className={cn(
								"shadow-xs h-6 gap-1.5 rounded-md px-3",
								"bg-gradient-to-br from-[rgb(38,31,70)] via-[rgb(36,26,214)] to-[rgb(165,23,253)]",
								"text-xs font-normal text-white",
								"hover:opacity-90",
							)}
							id={HTMLGuideTourElementId.AIOptimizationButton}
						>
							<Sparkles size={16} />
							{showButtonText && <span>{t("topicFiles.AIOptimization")}</span>}
							<ChevronDown size={16} />
						</Button>
					</ConditionalTooltip>
				</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="min-w-[280px]"
				style={{ zIndex: TOOLBAR_Z_INDEX.AI_EDIT_DROPDOWN }}
			>
				{aiEditItems.map((item) => (
					<DropdownMenuItem key={item.key} onClick={item.onClick}>
						<div className="flex items-start gap-3">
							<div className="mt-0.5 flex-shrink-0">{item.icon}</div>
							<div className="flex flex-col gap-1">
								<div className="text-sm font-medium">{item.label}</div>
								<div className="text-xs text-muted-foreground">
									{item.description}
								</div>
							</div>
						</div>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export default memo(AIEditButton)
