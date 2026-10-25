import IconButton from "../../primitives/custom/IconButton/index"
import { Layers3 } from "lucide-react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Tooltip, TooltipTrigger, TooltipContent } from "../../primitives/shadcn/tooltip"
import { useLayersUI } from "../../../app/providers/LayersUIProvider"
import { usePortalContainer } from "../../primitives/custom/PortalContainerContext"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"

import styles from "./index.module.css"

export default function LayersButton() {
	const { t } = useCanvasDesignI18n()
	const { collapsed, setCollapsed } = useLayersUI()
	const portalContainer = usePortalContainer()

	if (!collapsed) {
		return null
	}

	return (
		<Tooltip delayDuration={0}>
			<TooltipTrigger asChild>
				<div className={styles.layersButtonContainer} data-canvas-ui-component>
					<IconButton className={styles.layersButton} onClick={() => setCollapsed(false)}>
						<Layers3 size={16} />
					</IconButton>
				</div>
			</TooltipTrigger>
			<TooltipPrimitive.Portal container={portalContainer || undefined}>
				<TooltipContent
					side="top"
					sideOffset={4}
					className="border-black bg-black text-white"
				>
					<span>{t("layers.title", "图层")}</span>
					<TooltipPrimitive.Arrow className="fill-black" />
				</TooltipContent>
			</TooltipPrimitive.Portal>
		</Tooltip>
	)
}
