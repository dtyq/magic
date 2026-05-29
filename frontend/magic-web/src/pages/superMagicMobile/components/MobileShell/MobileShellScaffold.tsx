import { cn } from "@/lib/utils"

export interface MobileShellScaffoldProps {
	isSidebarOpen: boolean
	sidebar: React.ReactNode
	panel: React.ReactNode
	onCloseSidebar: () => void
	/** `data-testid` 前缀，各路由应使用唯一前缀避免 E2E 冲突 */
	testIdPrefix?: string
	/** 蒙层关闭按钮的无障碍文案（建议走 i18n） */
	closeSidebarAriaLabel?: string
	rootClassName?: string
	panelClassName?: string
}

/**
 * 移动端全屏抽屉 + 主面板位移动画壳层。
 * 各路由传入自己的 `sidebar` / `panel` 即可；侧栏滚动需保证侧栏根节点使用 `min-h-0` + 中间区 `flex-1 overflow-y-auto`。
 * 侧栏宽度由组件内部以 Tailwind 视口比例变量统一定义，避免业务页再传固定像素值；
 * 根背景使用 Tailwind 语义色 + `dark:` + `data-[sidebar-open=true]` 组合，避免页面层手写颜色三元表达式。
 * 主面板与侧栏轨道圆角使用 Tailwind 语义档位（`rounded-*-3xl`、`shadow-2xl`）。
 * 抽屉打开时主面板使用 `rounded-l-3xl` 裁切靠侧栏一侧的整条左缘（上、下），与侧栏 `rounded-tr-3xl` / `rounded-br-3xl` 接缝配套。
 */
export default function MobileShellScaffold({
	isSidebarOpen,
	sidebar,
	panel,
	onCloseSidebar,
	testIdPrefix = "mobile-shell",
	closeSidebarAriaLabel = "Close sidebar",
	rootClassName,
	panelClassName,
}: MobileShellScaffoldProps) {
	const transitionMs = 350

	return (
		<div
			data-sidebar-open={isSidebarOpen}
			className={cn(
				"relative h-full w-full overflow-hidden [--mobile-shell-sidebar-width:80vw]",
				// 原型分层：左侧菜单轨道始终使用 muted，主内容面板单独使用 background。
				"bg-muted",
				rootClassName,
			)}
			data-testid={`${testIdPrefix}-root`}
		>
			<div
				className="relative h-full w-full overflow-hidden"
				data-testid={`${testIdPrefix}-device`}
			>
				<div
					className="absolute inset-y-0 left-0 z-10 w-[var(--mobile-shell-sidebar-width)] overflow-hidden rounded-br-3xl rounded-tr-3xl"
					data-testid={`${testIdPrefix}-sidebar`}
				>
					{sidebar}
				</div>

				{isSidebarOpen && (
					<button
						type="button"
						aria-label={closeSidebarAriaLabel}
						onClick={onCloseSidebar}
						className="absolute inset-y-0 left-[var(--mobile-shell-sidebar-width)] right-0 z-40 bg-transparent"
						data-testid={`${testIdPrefix}-overlay`}
					/>
				)}

				<div
					className={cn(
						// 共享 panel 容器默认铺一层不透明背景，避免业务页忘记设置背景时透出后侧栏内容。
						"ease-[cubic-bezier(0.4,0,0.2,1)] absolute inset-0 z-30 overflow-hidden bg-mobile-background",
						"transition-[transform,box-shadow]",
						isSidebarOpen && "rounded-l-3xl shadow-2xl",
						isSidebarOpen
							? "translate-x-[var(--mobile-shell-sidebar-width)]"
							: "translate-x-0",
						panelClassName,
					)}
					style={{
						transitionDuration: `${transitionMs}ms`,
					}}
					data-testid={`${testIdPrefix}-panel`}
				>
					{panel}
				</div>
			</div>
		</div>
	)
}
