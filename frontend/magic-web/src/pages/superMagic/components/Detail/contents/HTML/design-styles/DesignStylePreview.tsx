import { useEffect, useState } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"
import type { DesignStyle } from "./catalog"
import DesignStyleLayoutPreview from "./DesignStyleLayoutPreview"
import DesignStyleGuidelines from "./DesignStyleGuidelines"
import DesignStyleComponentStates from "./DesignStyleComponentStates"
import type { DesignStyleDetailMode } from "./DesignStyleDetailHeader"
import DesignStylePageCanvas, { DesignStylePageCanvasToolbar } from "./DesignStylePageCanvas"
import DesignStyleRawPreview from "./DesignStyleRawPreview"
import type { SceneViewport } from "./DesignStyleScene"
import DesignStyleTokenPreview from "./DesignStyleTokenPreview"

interface DesignStylePreviewProps {
	style: DesignStyle
	mode: DesignStyleDetailMode
}

export default function DesignStylePreview({ style, mode }: DesignStylePreviewProps) {
	const isMobile = useIsMobile()
	const [viewport, setViewport] = useState<SceneViewport>(isMobile ? "mobile" : "desktop")

	useEffect(() => {
		// Avoid squeezing a desktop composition into the narrow dialog on small screens.
		if (isMobile) setViewport("mobile")
	}, [isMobile])

	return (
		<div
			className="mx-auto min-w-0 max-w-[1320px] space-y-4 pb-2 pt-4 sm:pt-6"
			data-testid="design-style-preview"
			data-preview-mode={mode}
		>
			{mode !== "raw" && (
				<div className="space-y-8">
					{mode === "details" && (
						<div className="space-y-3">
							<DesignStylePageCanvasToolbar
								viewport={viewport}
								onViewportChange={setViewport}
							/>
							<DesignStylePageCanvas style={style} viewport={viewport} />
						</div>
					)}
					<DesignStyleLayoutPreview style={style} />
					<DesignStyleTokenPreview style={style} />
					<DesignStyleComponentStates style={style} />
					<DesignStyleGuidelines style={style} />
				</div>
			)}
			{mode === "raw" && (
				<div>
					<DesignStyleRawPreview style={style} active />
				</div>
			)}
		</div>
	)
}
