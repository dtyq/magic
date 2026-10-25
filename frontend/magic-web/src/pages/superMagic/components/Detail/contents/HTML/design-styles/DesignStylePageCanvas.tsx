import { Laptop, Smartphone, Tablet } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { DesignStyle } from "./catalog"
import DesignStyleSectionHeader from "./DesignStyleSectionHeader"
import DesignStyleHtmlPreview from "./DesignStyleHtmlPreview"
import type { SceneViewport } from "./DesignStyleScene"

const WIDTHS: Record<SceneViewport, string> = {
	desktop: "100%",
	tablet: "min(100%, 760px)",
	mobile: "min(100%, 390px)",
}

interface DesignStylePageCanvasToolbarProps {
	viewport: SceneViewport
	onViewportChange: (viewport: SceneViewport) => void
}

export function DesignStylePageCanvasToolbar({
	viewport,
	onViewportChange,
}: DesignStylePageCanvasToolbarProps) {
	const { t } = useTranslation("super")
	const viewports = [
		{
			value: "desktop" as const,
			Icon: Laptop,
			label: t("htmlEditor.designStyle.viewports.desktop"),
		},
		{
			value: "tablet" as const,
			Icon: Tablet,
			label: t("htmlEditor.designStyle.viewports.tablet"),
		},
		{
			value: "mobile" as const,
			Icon: Smartphone,
			label: t("htmlEditor.designStyle.viewports.mobile"),
		},
	]

	return (
		<DesignStyleSectionHeader
			title={t("htmlEditor.designStyle.pagePreview")}
			description={t("htmlEditor.designStyle.gallery.exampleNotice")}
			testId="design-style-page-preview-header"
			action={
				<div
					className="flex rounded-lg border border-border/70 bg-background p-0.5"
					role="tablist"
					aria-label={t("htmlEditor.designStyle.gallery.viewportLabel")}
				>
					{viewports.map(({ value, Icon, label }) => {
						return (
							<button
								key={value}
								type="button"
								role="tab"
								aria-label={label}
								aria-selected={viewport === value}
								className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-[10px] font-medium transition-[color,background-color,transform] active:scale-[0.96] ${viewport === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
								onClick={() => onViewportChange(value)}
							>
								<Icon
									className="size-4"
									strokeWidth={viewport === value ? 2 : 1.5}
									aria-hidden="true"
								/>
								<span className="hidden sm:inline">{label}</span>
							</button>
						)
					})}
				</div>
			}
		/>
	)
}

interface DesignStylePageCanvasProps {
	style: DesignStyle
	viewport: SceneViewport
}

export default function DesignStylePageCanvas({ style, viewport }: DesignStylePageCanvasProps) {
	return (
		<section data-testid="design-style-page-canvas">
			<div className="min-w-0">
				<div
					className="mx-auto overflow-hidden rounded-md border border-border bg-background"
					style={{ width: WIDTHS[viewport] }}
					data-testid="design-style-scene-viewport"
					data-viewport={viewport}
				>
					<DesignStyleHtmlPreview style={style} viewport={viewport} />
				</div>
			</div>
		</section>
	)
}
