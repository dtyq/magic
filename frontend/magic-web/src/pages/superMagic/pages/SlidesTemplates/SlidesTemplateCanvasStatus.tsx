import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"

interface SlidesTemplateCanvasStatusProps {
	isInitialLoading: boolean
	isLoading: boolean
	isLoadingMore: boolean
	isRefreshFailed: boolean
	isRefreshing: boolean
	onRetryRefresh?: () => void
	templateCount: number
}

export default function SlidesTemplateCanvasStatus({
	isInitialLoading,
	isLoading,
	isLoadingMore,
	isRefreshFailed,
	isRefreshing,
	onRetryRefresh,
	templateCount,
}: SlidesTemplateCanvasStatusProps) {
	const { t } = useTranslation("crew/create")

	return (
		<>
			{isRefreshFailed ? (
				<div
					className="pointer-events-auto absolute left-1/2 top-5 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-red-300/20 bg-red-950/75 px-3 py-1.5 text-xs text-red-50 shadow-lg backdrop-blur-md"
					data-testid="slides-template-canvas-refresh-error"
				>
					<span>{t("playbook.edit.presets.form.refreshFailed")}</span>
					{onRetryRefresh ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-6 rounded-full px-2 text-xs text-red-50 hover:bg-white/10 hover:text-white"
							onClick={onRetryRefresh}
						>
							{t("playbook.edit.presets.form.retry")}
						</Button>
					) : null}
				</div>
			) : null}
			<div
				className={cn(
					"pointer-events-none absolute right-5 top-5 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/75 shadow-lg backdrop-blur-md",
					!isInitialLoading && !isRefreshing && !isLoadingMore && "opacity-0",
				)}
				data-testid="slides-template-canvas-status"
			>
				{isInitialLoading
					? t("playbook.edit.presets.form.loading")
					: isLoadingMore
						? t("playbook.edit.presets.form.loadingMore")
						: t("playbook.edit.presets.form.refreshing")}
			</div>
			{!isLoading && !isLoadingMore && !isRefreshing && templateCount === 0 ? (
				<div
					className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-black/50 px-5 py-4 text-sm text-white/75 shadow-xl backdrop-blur-md"
					data-testid="slides-template-canvas-empty"
				>
					{t("playbook.edit.presets.form.emptySlidesTemplates")}
				</div>
			) : null}
		</>
	)
}
