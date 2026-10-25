import { useId } from "react"
import { cn } from "../../../runtime/shared/lib/utils"
import { MinimapButton, MinimapPanel, useCachedMinimapOpen } from "../minimap"
import Zoom from "../zoom"
import MediaLabelsSettings from "./MediaLabelsSettings"

interface ViewportControlsProps {
	/** 与 CanvasDesignProps.shareHostBottomChrome 一致，由宿主注入。 */
	shareHostBottomChrome?: boolean
}

/** 统一管理右下角视口控件的定位、排列和小地图浮层显隐。 */
export default function ViewportControls({ shareHostBottomChrome = false }: ViewportControlsProps) {
	const minimapPanelId = useId()
	const { isMinimapOpen, toggleMinimap } = useCachedMinimapOpen()

	return (
		<div
			className={cn(
				"absolute right-2 z-[3] flex max-w-[calc(100%-16px)] flex-col items-end gap-2",
				shareHostBottomChrome ? "bottom-[46px] md:bottom-[34px]" : "bottom-2",
			)}
			data-canvas-ui-component
		>
			{isMinimapOpen ? <MinimapPanel id={minimapPanelId} /> : null}
			<div className="flex items-center gap-2">
				<Zoom />
				<MediaLabelsSettings />
				<MinimapButton
					active={isMinimapOpen}
					panelId={minimapPanelId}
					onToggle={toggleMinimap}
				/>
			</div>
		</div>
	)
}
