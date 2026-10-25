import { SupportLocales } from "@/constants/locale"
import { cn } from "@/utils/cn"

export const siderClassNames = {
	root: "relative box-border flex h-[calc(100vh-var(--title-bar-height))] min-w-14 shrink-0 select-none flex-col items-center justify-between overflow-hidden border-r border-border !p-2.5 transition-[width] duration-200 ease-in-out after:absolute after:left-[120px] after:top-[120px] after:h-[75vh] after:w-[75vw] after:rotate-[-165deg] after:rounded-[933.343px] after:opacity-50 after:[background:conic-gradient(from_0deg_at_50%_50%,#ff0080_0deg,#e0f_54.00000214576721deg,#00a6ff_105.83999991416931deg,#4797ff_161.99999570846558deg,#04f_251.99999570846558deg,#ff8000_306.00000858306885deg,#f0c_360deg)] after:blur-[122.50128173828125px] after:content-[''] [&_.magic-menu-item:hover_.magic-menu-item-icon]:[stroke-dasharray:100] [&_.magic-menu-item:hover_.magic-menu-item-icon]:animate-sidebar-icon-stroke",
	divider: "mx-auto my-2.5 w-full",
	menus: "flex w-full flex-1 flex-col [&>.magic-menu:not(:first-child)]:mt-[5px] [&>.magic-menu:not(:first-child)]:border-t [&>.magic-menu:not(:first-child)]:border-border [&>.magic-menu:not(:first-child)]:pt-[5px]",
	icon: "flex size-[30px] flex-none cursor-pointer items-center justify-center rounded-lg bg-neutral-200 hover:bg-neutral-100 active:bg-neutral-300 dark:bg-white/[0.15] dark:hover:bg-white/10 dark:active:bg-white/20",
}

export function getMenuClassName(language: string) {
	return cn(
		"w-full !border-e-0 bg-transparent ![--magic-menu-item-color:rgb(var(--foreground-rgb)/0.8)] ![--magic-menu-item-selected-bg:rgb(var(--primary-rgb)/0.08)] ![--magic-menu-item-selected-color:rgb(var(--foreground-rgb)/0.8)] dark:![--magic-menu-item-selected-bg:rgb(var(--primary-rgb)/0.2)] dark:![--magic-menu-item-selected-color:rgb(var(--primary-rgb))] [&>.magic-menu-item]:mx-0 [&>.magic-menu-item]:h-[30px] [&>.magic-menu-item]:w-full [&>.magic-menu-item]:gap-1 [&>.magic-menu-item]:px-1.5 [&>.magic-menu-item]:py-0 [&_.magic-menu-item-selected]:!text-foreground/80 dark:[&_.magic-menu-item-selected]:!text-primary [&_.magic-menu-title-content]:!ml-0",
		language === SupportLocales.zhCN
			? "[&_.magic-menu-title-content]:text-sm"
			: "[&_.magic-menu-title-content]:text-xs",
	)
}
