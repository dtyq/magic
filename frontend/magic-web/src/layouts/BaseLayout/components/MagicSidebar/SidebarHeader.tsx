import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import type { SidebarHeaderProps } from "./types"
import Logo from "../Header/components/Logo"
import { observer } from "mobx-react-lite"
import { useNavigateToSuperHome } from "./hooks/useNavigateToSuperHome"

function SidebarHeader({ collapsed, onToggleCollapse }: SidebarHeaderProps) {
	const { superRouteUrl, handleNavigateToSuperHome } = useNavigateToSuperHome()

	return (
		<div
			data-testid="sidebar-header-root"
			className={cn(
				"h-13 w-full shrink-0",
				collapsed
					? "flex items-center justify-center px-1.5 py-2"
					: "flex items-center gap-2 p-2",
			)}
		>
			{collapsed ? (
				<div
					className="group/sidebar-toggle relative flex h-9 w-9 items-center justify-center rounded-md"
					data-testid="sidebar-header-collapsed"
				>
					<a
						className="flex h-9 w-9 cursor-pointer items-center justify-center transition-opacity duration-200 group-focus-within/sidebar-toggle:pointer-events-none group-focus-within/sidebar-toggle:opacity-0 group-hover/sidebar:pointer-events-none group-hover/sidebar:opacity-0"
						href={superRouteUrl}
						onClick={handleNavigateToSuperHome}
						data-testid="sidebar-header-logo"
					>
						<Logo className="size-full" variant="minimal" />
					</a>

					<Button
						variant="ghost"
						size="icon"
						className="pointer-events-none absolute inset-0 z-10 h-9 w-9 rounded-md opacity-0 transition-opacity duration-200 hover:bg-accent group-focus-within/sidebar-toggle:pointer-events-auto group-focus-within/sidebar-toggle:opacity-100 group-hover/sidebar:pointer-events-auto group-hover/sidebar:opacity-100"
						aria-label="Expand sidebar"
						onClick={onToggleCollapse}
						data-testid="sidebar-header-expand"
					>
						<PanelLeftOpen className="h-4 w-4 text-sidebar-foreground" />
					</Button>
				</div>
			) : (
				<>
					<a
						className="flex h-9 min-h-px min-w-px shrink-0 grow basis-0 items-center justify-center transition-opacity duration-200"
						href={superRouteUrl}
						onClick={handleNavigateToSuperHome}
						data-testid="sidebar-header-logo"
					>
						<Logo className="h-9 w-fit" variant="full" />
					</a>

					<Button
						variant="ghost"
						size="icon"
						className="ml-auto h-9 w-9 shrink-0 rounded-md hover:bg-accent"
						aria-label="Collapse sidebar"
						onClick={onToggleCollapse}
						data-testid="sidebar-header-collapse"
					>
						<PanelLeftClose className="h-4 w-4 text-sidebar-foreground" />
					</Button>
				</>
			)}
		</div>
	)
}

export default observer(SidebarHeader)
