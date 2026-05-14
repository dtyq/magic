import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"
import { useTheme } from "@/models/config/hooks"

export interface MobileShellScaffoldProps {
	isSidebarOpen: boolean
	sidebar: React.ReactNode
	panel: React.ReactNode
	onCloseSidebar: () => void
	/** `data-testid` 前缀，各路由应使用唯一前缀避免 E2E 冲突 */
	testIdPrefix?: string
	/**
	 * 是否同步 `theme-color` 与 `html/body` 背景（全屏壳层场景一般为 true）。
	 * 若页面外层已有统一主题管理，可设为 false 避免互相覆盖。
	 */
	syncDocumentTheme?: boolean
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
	syncDocumentTheme = true,
	closeSidebarAriaLabel = "Close sidebar",
	rootClassName,
	panelClassName,
}: MobileShellScaffoldProps) {
	const transitionMs = 350
	const rootRef = useRef<HTMLDivElement>(null)
	const { prefersColorScheme } = useTheme()

	useEffect(() => {
		if (!syncDocumentTheme || !rootRef.current) return

		const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
		const previousThemeColor = themeMeta?.getAttribute("content")
		const previousHtmlBackground = document.documentElement.style.background
		const previousBodyBackground = document.body.style.background
		const nextThemeColor = getComputedStyle(rootRef.current).backgroundColor

		themeMeta?.setAttribute("content", nextThemeColor)
		document.documentElement.style.background = nextThemeColor
		document.body.style.background = nextThemeColor

		return () => {
			if (themeMeta && previousThemeColor) {
				themeMeta.setAttribute("content", previousThemeColor)
			}
			document.documentElement.style.background = previousHtmlBackground
			document.body.style.background = previousBodyBackground
		}
	}, [isSidebarOpen, prefersColorScheme, syncDocumentTheme])

	return (
		<div
			ref={rootRef}
			data-sidebar-open={isSidebarOpen}
			className={cn(
				"fixed inset-0 h-screen w-screen overflow-hidden [--mobile-shell-sidebar-width:80vw]",
				"[--mobile-shell-bg-closed:#fafafa] [--mobile-shell-bg-open:#f5f5f5]",
				"dark:[--mobile-shell-bg-closed:#0a0a0a] dark:[--mobile-shell-bg-open:#171717]",
				"bg-[var(--mobile-shell-bg-closed)] data-[sidebar-open=true]:bg-[var(--mobile-shell-bg-open)]",
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
						"ease-[cubic-bezier(0.4,0,0.2,1)] absolute inset-0 z-30 overflow-hidden bg-background",
						"transition-[transform,box-shadow]",
						isSidebarOpen && "rounded-l-3xl shadow-2xl",
						isSidebarOpen
							? "translate-x-[var(--mobile-shell-sidebar-width)]"
							: "translate-x-0",
						panelClassName,
					)}
					style={{ transitionDuration: `${transitionMs}ms` }}
					data-testid={`${testIdPrefix}-panel`}
				>
					{panel}
				</div>
			</div>
		</div>
	)
}
