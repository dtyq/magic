import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Map as MapIcon } from "lucide-react"
import { useState } from "react"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import { cn } from "../../../runtime/shared/lib/utils"
import { usePortalContainer } from "../../primitives/custom/PortalContainerContext"
import { Button } from "../../primitives/shadcn/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../primitives/shadcn/tooltip"

interface MinimapButtonProps {
	active: boolean
	panelId: string
	onToggle: () => void
}

export default function MinimapButton({ active, panelId, onToggle }: MinimapButtonProps) {
	const { t } = useCanvasDesignI18n()
	const portalContainer = usePortalContainer()
	const label = t("zoom.minimap", "小地图")
	const [isPointerHovering, setIsPointerHovering] = useState(false)
	const tooltipOpen = !active && isPointerHovering

	return (
		<Tooltip delayDuration={0} open={tooltipOpen}>
			<TooltipTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className={cn(
						"size-[34px] shrink-0 rounded-full border border-border bg-[var(--base-popover,#fff)] shadow-sm hover:bg-accent",
						active &&
							"border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground hover:opacity-80",
					)}
					aria-label={label}
					aria-pressed={active}
					aria-expanded={active}
					aria-controls={panelId}
					onPointerEnter={() => setIsPointerHovering(true)}
					onPointerLeave={() => setIsPointerHovering(false)}
					onPointerCancel={() => setIsPointerHovering(false)}
					onClick={() => {
						// Prevent a click/focus transition from opening the tooltip.
						setIsPointerHovering(false)
						onToggle()
					}}
				>
					<MapIcon size={16} />
				</Button>
			</TooltipTrigger>
			<TooltipPrimitive.Portal container={portalContainer || undefined}>
				<TooltipContent
					side="top"
					sideOffset={6}
					className="border-black bg-black text-white"
				>
					<span>{label}</span>
					<TooltipPrimitive.Arrow className="fill-black" />
				</TooltipContent>
			</TooltipPrimitive.Portal>
		</Tooltip>
	)
}
