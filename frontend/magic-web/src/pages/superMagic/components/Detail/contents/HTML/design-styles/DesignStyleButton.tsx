import { useCallback, useRef, useState } from "react"
import { Palette } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { useTranslation } from "react-i18next"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import { cn } from "@/utils/cn"
import ConditionalTooltip from "@/pages/superMagic/components/Detail/components/EditToolbar/ConditionalTooltip"
import DesignStyleDialog from "./DesignStyleDialog"
import { buildDesignStylePromptContent } from "./designStylePrompt"
import type { DesignStyle } from "./catalog"

interface DesignStyleButtonProps {
	fileInfo: {
		fileId: string
		fileName?: string
		filePath?: string
	}
	showButtonText?: boolean
	disabled?: boolean
	testId?: string
	getPopupContainer?: () => HTMLElement | null
	isMobile?: boolean
}

export default function DesignStyleButton({
	fileInfo,
	showButtonText = false,
	disabled = false,
	testId,
	getPopupContainer,
	isMobile = false,
}: DesignStyleButtonProps) {
	const { t } = useTranslation("super")
	const [open, setOpen] = useState(false)
	const submittedRequestRef = useRef<string | null>(null)

	const canApply = Boolean(fileInfo.fileId && fileInfo.fileName && fileInfo.filePath) && !disabled

	const handleOpenChange = useCallback((nextOpen: boolean) => {
		if (nextOpen) submittedRequestRef.current = null
		setOpen(nextOpen)
	}, [])

	const handleApply = useCallback(
		(style: DesignStyle) => {
			if (!fileInfo.fileName || !fileInfo.filePath) return
			const requestKey = `${fileInfo.fileId}:${style.code}`
			if (submittedRequestRef.current === requestKey) return
			const content: JSONContent = buildDesignStylePromptContent(
				{
					fileId: fileInfo.fileId,
					fileName: fileInfo.fileName,
					filePath: fileInfo.filePath,
				},
				style,
			)
			submittedRequestRef.current = requestKey
			pubsub.publish(PubSubEvents.Set_Input_Message, content)
			setOpen(false)
		},
		[fileInfo.fileId, fileInfo.fileName, fileInfo.filePath],
	)

	const label = t("htmlEditor.designStyle.open")

	if (isMobile) return null

	return (
		<>
			<ConditionalTooltip
				showText={Boolean(showButtonText)}
				title={label}
				getPopupContainer={getPopupContainer}
			>
				<Button
					variant="outline"
					size="sm"
					disabled={disabled}
					onClick={() => setOpen(true)}
					className={cn(
						"h-6 rounded-[8px] py-0 text-xs font-normal shadow-xs",
						showButtonText ? "gap-1.5 px-3" : "gap-0 px-1.5",
					)}
					title={label}
					aria-label={label}
					data-testid={testId}
				>
					<Palette className="size-4" />
					{showButtonText && <span>{label}</span>}
				</Button>
			</ConditionalTooltip>
			<DesignStyleDialog
				open={open}
				onOpenChange={handleOpenChange}
				onApply={handleApply}
				canApply={canApply}
			/>
		</>
	)
}
