import { Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { useMobileShellMenu } from "@/pages/superMagicMobile/components/MobileShell"

export interface ShellDemoSidebarProps {
	appName: string
	accountName: string
	recentlyUsedLabel: string
	upgradeLabel: string
	themeToggleDisabled: boolean
	isDarkAppearance: boolean
	onThemeToggle: () => void
}

/** 侧栏展示：菜单数据来自 `useMobileShellMenu`；品牌区与主题切换由 container 注入 */
export default function ShellDemoSidebar({
	appName,
	accountName,
	recentlyUsedLabel,
	upgradeLabel,
}: ShellDemoSidebarProps) {
	const { activeView, navItems, recentItems, onNavigate, onGoHome } = useMobileShellMenu()

	const navRowClass = (isActive: boolean) =>
		cn(
			"flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors",
			isActive
				? "dark:ring-white/12 bg-background text-foreground shadow-sm dark:bg-zinc-950 dark:shadow-md dark:ring-1"
				: "text-foreground/80 active:bg-black/5 dark:active:bg-white/10",
		)

	return (
		<div className="flex h-full min-h-0 flex-col bg-muted dark:bg-neutral-800">
			<div
				className="flex shrink-0 items-center px-4 pb-4"
				style={{ paddingTop: "calc(var(--safe-area-inset-top, 0px) + 16px)" }}
			>
				<button
					type="button"
					className="flex items-center gap-3 text-left"
					onClick={onGoHome}
					data-testid="mobile-shell-demo-brand-button"
				>
					<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ffd84d] text-lg font-semibold text-black">
						M
					</div>
					<div className="text-xl font-semibold text-foreground">{appName}</div>
				</button>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-4">
				<div className="dark:border-white/12 space-y-1 border-b border-border pb-4">
					{navItems.slice(0, 3).map(({ key, icon: Icon, label }) => {
						const isActive = activeView === key
						return (
							<button
								key={key}
								type="button"
								onClick={() => onNavigate(key)}
								data-testid={`mobile-shell-demo-nav-item-${key}`}
								className={navRowClass(isActive)}
							>
								<Icon size={18} />
								<span className="text-base">{label}</span>
							</button>
						)
					})}
				</div>

				<div className="dark:border-white/12 space-y-1 border-b border-border py-4">
					{navItems.slice(3).map(({ key, icon: Icon, label }) => {
						const isActive = activeView === key
						return (
							<button
								key={key}
								type="button"
								onClick={() => onNavigate(key)}
								data-testid={`mobile-shell-demo-nav-item-${key}`}
								className={navRowClass(isActive)}
							>
								<Icon size={18} />
								<span className="text-base">{label}</span>
							</button>
						)
					})}
				</div>

				<div className="pt-4">
					<div className="px-3 pb-2 text-sm text-muted-foreground dark:text-zinc-400">
						{recentlyUsedLabel}
					</div>
					<div className="space-y-1">
						{recentItems.map((item) => (
							<button
								key={item.id}
								type="button"
								data-testid={`mobile-shell-demo-recent-item-${item.id}`}
								className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-foreground/85 transition-colors active:bg-black/5 dark:active:bg-white/10"
							>
								<Sparkles size={16} className="text-muted-foreground" />
								<span className="truncate text-base">{item.title}</span>
							</button>
						))}
					</div>
				</div>
			</div>

			<div
				className="dark:border-white/12 flex shrink-0 flex-col gap-3 border-t border-border px-4 pt-3"
				style={{ paddingBottom: "calc(var(--safe-area-inset-bottom, 0px) + 16px)" }}
			>
				<div className="flex items-center justify-between gap-3">
					<div
						className={cn(
							"flex min-w-0 flex-1 items-center gap-3 rounded-full bg-background px-3 py-2 shadow-lg",
							"dark:ring-white/12 dark:bg-black dark:text-white dark:shadow-none dark:ring-1",
						)}
						data-testid="mobile-shell-demo-account-pill"
					>
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-medium text-white">
							D
						</div>
						<span className="truncate text-sm font-medium text-foreground">
							{accountName}
						</span>
					</div>
					<button
						type="button"
						data-testid="mobile-shell-demo-upgrade-button"
						className={cn(
							"shrink-0 rounded-full bg-background px-4 py-2 text-sm font-medium text-foreground shadow-lg transition-transform active:scale-95",
							"dark:ring-white/12 dark:bg-black dark:text-white dark:shadow-none dark:ring-1",
						)}
					>
						{upgradeLabel}
					</button>
				</div>
			</div>
		</div>
	)
}
