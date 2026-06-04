import { type ReactNode } from "react"
import { ChevronRight, RefreshCw } from "lucide-react"
import { MobileShellSidebarToggleButton } from "@/pages/superMagicMobile/components/MobileShell"
import { Button } from "@/components/shadcn-ui/button"
import { AppMenuIconType } from "@/apis/types"
import IconComponent from "@/pages/superMagic/components/IconViewComponent"
import { ScrollEdgeFadeContainer } from "@/components/base-mobile/ScrollEdgeFade"
import { cn } from "@/lib/utils"
import type { AppsPageEntry } from "../hooks/useAppsPage"

interface AppsPageViewProps {
	title: string
	errorTitle: string
	errorDescription: string
	emptyTitle: string
	emptyDescription: string
	/** When set, replaces the default title/description empty block (e.g. mobile DataEmptyState). */
	emptyContent?: ReactNode
	retryLabel: string
	loading: boolean
	hasError: boolean
	entries: AppsPageEntry[]
	onRetry: () => void
	onOpenEntry: (entry: AppsPageEntry) => void
}

const APP_ROW_TONES = [
	{
		box: "bg-violet-500/8 dark:bg-violet-400/12",
		icon: "text-violet-500 dark:text-violet-300",
	},
	{
		box: "bg-sky-500/8 dark:bg-sky-400/12",
		icon: "text-sky-500 dark:text-sky-300",
	},
	{
		box: "bg-orange-500/8 dark:bg-orange-400/12",
		icon: "text-orange-500 dark:text-orange-300",
	},
	{
		box: "bg-amber-500/8 dark:bg-amber-400/12",
		icon: "text-amber-500 dark:text-amber-300",
	},
] as const

/**
 * 为真实应用目录生成稳定的视觉 tint，避免列表因真实数据源不同而失去原型式的图标层次。
 */
function resolveAppRowTone(entryId: string) {
	const toneIndex = Array.from(entryId).reduce((sum, char) => sum + char.charCodeAt(0), 0)
	return APP_ROW_TONES[toneIndex % APP_ROW_TONES.length]
}

/**
 * 统一渲染应用图标，兼容固定快捷项图标与后端返回的图片/Icon 两种目录形态。
 */
function AppsPageItemIcon({
	entry,
	iconClassName,
}: {
	entry: AppsPageEntry
	iconClassName: string
}) {
	if (entry.renderIcon) {
		return <span className="flex items-center justify-center">{entry.renderIcon()}</span>
	}

	if (entry.iconType === AppMenuIconType.Image && entry.iconUrl) {
		return (
			<img
				src={entry.iconUrl}
				alt={entry.title}
				className="size-6 rounded-md object-cover"
				draggable={false}
			/>
		)
	}

	return (
		<span className={cn("flex items-center justify-center", iconClassName)}>
			<IconComponent selectedIcon={entry.icon} size={22} iconColor="currentColor" />
		</span>
	)
}

/**
 * 单个应用行保持轻量目录列表形态，首期只暴露点击进入能力，不额外引入筛选或二级动作。
 */
function AppsPageRow({
	entry,
	onOpen,
}: {
	entry: AppsPageEntry
	onOpen: (entry: AppsPageEntry) => void
}) {
	const tone = resolveAppRowTone(entry.id)

	return (
		<button
			type="button"
			className="relative flex h-16 w-full shrink-0 items-center overflow-hidden text-left transition-opacity active:opacity-70"
			onClick={() => onOpen(entry)}
			data-testid={`super-apps-item-${entry.id}`}
		>
			<div className="flex w-full shrink-0 items-center gap-2 rounded-lg px-3 py-[10px]">
				<div
					className={cn(
						"flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px]",
						tone.box,
					)}
				>
					<AppsPageItemIcon entry={entry} iconClassName={tone.icon} />
				</div>
				<p className="min-w-0 flex-1 truncate text-[16px] font-medium leading-6 text-foreground">
					{entry.title}
				</p>
				<ChevronRight className="h-4 w-4 shrink-0 text-foreground" aria-hidden />
			</div>
		</button>
	)
}

/**
 * Apps 页面 View 只负责顶部栏、滚动列表和空态/错误态视觉，不承载数据请求逻辑。
 */
export function AppsPageView(props: AppsPageViewProps) {
	const {
		title,
		errorTitle,
		errorDescription,
		emptyTitle,
		emptyDescription,
		emptyContent,
		retryLabel,
		loading,
		hasError,
		entries,
		onRetry,
		onOpenEntry,
	} = props

	return (
		<div
			className="absolute inset-0 flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-mobile-background"
			data-testid="super-apps-page-mobile"
		>
			<header className="mobile-page-header" data-testid="super-apps-top-bar">
				<MobileShellSidebarToggleButton testId="super-apps-menu-button" />
				<p
					className="min-w-0 flex-1 truncate px-2 text-center font-poppins text-[18px] font-medium leading-6 text-foreground"
					data-testid="super-apps-title"
				>
					{title}
				</p>
				{/* 右侧占位符保持与左侧按钮等宽，让标题在视觉上保持居中 */}
				<div className="mobile-page-header-btn pointer-events-none opacity-0" aria-hidden />
			</header>

			<ScrollEdgeFadeContainer
				fadeColor="mobile-background"
				className="min-h-0 flex-1"
				scrollClassName="no-scrollbar flex flex-col gap-1 px-3 pb-4 pt-2"
				contentDeps={[entries.length, loading, hasError]}
			>
				<div className="flex flex-col gap-1" data-testid="super-apps-scroll-container">
					{loading ? (
						<div className="flex flex-col gap-1" data-testid="super-apps-loading">
							{[1, 2, 3, 4].map((item) => (
								<div
									key={item}
									className="h-16 animate-pulse rounded-lg bg-muted/40"
								/>
							))}
						</div>
					) : null}

					{!loading && hasError ? (
						<div
							className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center"
							data-testid="super-apps-error"
						>
							<div className="space-y-1">
								<p className="text-base font-medium text-foreground">
									{errorTitle}
								</p>
								<p className="text-sm text-muted-foreground">{errorDescription}</p>
							</div>
							<Button
								type="button"
								variant="outline"
								className="gap-2"
								onClick={onRetry}
								data-testid="super-apps-retry-button"
							>
								<RefreshCw className="size-4" aria-hidden />
								{retryLabel}
							</Button>
						</div>
					) : null}

					{!loading && !hasError && entries.length === 0 ? (
						<div
							className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center"
							data-testid="super-apps-empty"
						>
							{emptyContent ?? (
								<>
									<p className="text-base font-medium text-foreground">
										{emptyTitle}
									</p>
									<p className="text-sm text-muted-foreground">
										{emptyDescription}
									</p>
								</>
							)}
						</div>
					) : null}

					{!loading && !hasError && entries.length > 0 ? (
						<div className="flex flex-col gap-1" data-testid="super-apps-list">
							{entries.map((entry) => (
								<AppsPageRow key={entry.id} entry={entry} onOpen={onOpenEntry} />
							))}
						</div>
					) : null}
				</div>
			</ScrollEdgeFadeContainer>
		</div>
	)
}
