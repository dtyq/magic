import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Toggle } from "@/opensource/components/shadcn-ui/toggle"
import { TooltipContent, TooltipTrigger } from "@/opensource/components/shadcn-ui/tooltip"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Type } from "lucide-react"
import type { HTMLEditorV2Ref } from "../../../iframe-bridge/types/props"

interface TextEditToggleProps {
	editorRef: React.RefObject<HTMLEditorV2Ref>
	selector?: string
	isEnabled: boolean
	onToggle: (enabled: boolean) => void
	disabled?: boolean
}

/**
 * Text editing toggle component
 */
export function TextEditToggle({
	editorRef,
	selector,
	isEnabled,
	onToggle,
	disabled,
}: TextEditToggleProps) {
	const { t } = useTranslation("super")

	const handleToggle = useCallback(async () => {
		if (!editorRef.current || !selector) return

		try {
			if (isEnabled) {
				await editorRef.current.disableTextEditing(selector)
				onToggle(false)
			} else {
				await editorRef.current.enableTextEditing(selector)
				onToggle(true)
			}
		} catch (error) {
			console.error("Toggle text editing failed:", error)
		}
	}, [editorRef, selector, isEnabled, onToggle])

	return (
		<TooltipPrimitive.Root>
			<TooltipTrigger asChild>
				<span>
					<Toggle
						size="sm"
						pressed={isEnabled}
						onPressedChange={handleToggle}
						disabled={disabled}
						className="h-8 w-8 p-0"
					>
						<Type className="h-4 w-4" />
					</Toggle>
				</span>
			</TooltipTrigger>
			<TooltipContent>{t("stylePanel.editTextContent")}</TooltipContent>
		</TooltipPrimitive.Root>
	)
}
