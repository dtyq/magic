import { memo } from "react"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import { Grid2X2, List } from "lucide-react"
import type { I18nTexts } from "../../i18n/types"
import { MentionPanelViewMode } from "../../types"

const VIEW_MODE_BUTTON_CLASS =
	"size-6 rounded-sm p-0 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:border-transparent focus-visible:ring-0"

interface ViewModeSwitcherProps {
	isGalleryMode: boolean
	t: I18nTexts
	onViewModeChange: (nextViewMode: MentionPanelViewMode) => void
}

const ViewModeSwitcher = memo(function ViewModeSwitcher(props: ViewModeSwitcherProps) {
	const { isGalleryMode, t, onViewModeChange } = props

	return (
		<div className="flex h-9 shrink-0 items-center rounded-tr-lg border-b border-l border-input bg-background px-1 shadow-xs">
			<div
				className="flex h-7 items-center rounded border border-border bg-muted/40 p-0.5"
				role="group"
				aria-label={t.ariaLabels.viewMode}
				data-testid="mention-panel-view-mode-switcher"
			>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className={cn(
						VIEW_MODE_BUTTON_CLASS,
						!isGalleryMode && "bg-background text-foreground shadow-xs",
					)}
					onClick={(event) => {
						event.preventDefault()
						event.stopPropagation()
						onViewModeChange(MentionPanelViewMode.LIST)
					}}
					aria-label={t.ariaLabels.listView}
					aria-pressed={!isGalleryMode}
					tabIndex={-1}
					data-testid="mention-panel-view-mode-list"
				>
					<List className="size-3.5" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className={cn(
						VIEW_MODE_BUTTON_CLASS,
						isGalleryMode && "bg-background text-foreground shadow-xs",
					)}
					onClick={(event) => {
						event.preventDefault()
						event.stopPropagation()
						onViewModeChange(MentionPanelViewMode.GALLERY)
					}}
					aria-label={t.ariaLabels.galleryView}
					aria-pressed={isGalleryMode}
					tabIndex={-1}
					data-testid="mention-panel-view-mode-gallery"
				>
					<Grid2X2 className="size-3.5" />
				</Button>
			</div>
		</div>
	)
})

ViewModeSwitcher.displayName = "ViewModeSwitcher"

export default ViewModeSwitcher
