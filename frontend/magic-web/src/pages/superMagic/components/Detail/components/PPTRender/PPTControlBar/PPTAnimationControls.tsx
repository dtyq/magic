import { useLayoutEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { GalleryHorizontalEnd, ListOrdered } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import type { PPTControlBarProps } from "./types"

export function PPTAnimationControls({
	onOpenTransitions,
	onToggleBuildPanel,
	buildPanelOpen,
}: Pick<PPTControlBarProps, "onOpenTransitions" | "onToggleBuildPanel" | "buildPanelOpen">) {
	const { t } = useTranslation("super")
	const triggerRef = useRef<HTMLButtonElement>(null)
	const wasOpen = useRef(Boolean(buildPanelOpen))
	useLayoutEffect(() => {
		const button = triggerRef.current
		// A removed sidebar must not leave keyboard focus stranded on the document body.
		if (
			wasOpen.current &&
			!buildPanelOpen &&
			button &&
			button.ownerDocument.activeElement === button.ownerDocument.body
		)
			button.focus()
		wasOpen.current = Boolean(buildPanelOpen)
	}, [buildPanelOpen])
	return (
		<>
			{onOpenTransitions && (
				<Button
					variant="ghost"
					size="sm"
					className="h-7 gap-[5px] px-[7px]"
					data-testid="ppt-control-bar-transitions"
					onClick={onOpenTransitions}
				>
					<GalleryHorizontalEnd className="size-4" />
					{t("ppt.transitions.title")}
				</Button>
			)}
			{onToggleBuildPanel && (
				<Button
					variant="ghost"
					size="sm"
					className="h-7 gap-[5px] px-[7px] aria-pressed:bg-accent"
					data-testid="ppt-control-bar-builds"
					ref={triggerRef}
					aria-pressed={Boolean(buildPanelOpen)}
					aria-expanded={Boolean(buildPanelOpen)}
					onClick={onToggleBuildPanel}
				>
					<ListOrdered className="size-4" />
					{t("ppt.build.title")}
				</Button>
			)}
		</>
	)
}
