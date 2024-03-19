import { observer } from "mobx-react-lite"
import { sidebarStore } from "@/opensource/stores/layout"
import { cn } from "@/opensource/lib/utils"
import {
	SidebarProvider,
	SidebarHeader as ShadcnSidebarHeader,
	SidebarContent as ShadcnSidebarContent,
	SidebarFooter as ShadcnSidebarFooter,
} from "@/opensource/components/shadcn-ui/sidebar"
import MagicSidebarHeader from "./SidebarHeader"
import MagicSidebarContent from "./SidebarContent"
import MagicSidebarFooter from "./SidebarFooter"
import Divider from "@/opensource/components/other/Divider"

const MagicSidebar = observer(() => {
	const { collapsed, toggleCollapsed, setCollapsed } = sidebarStore

	return (
		<SidebarProvider
			open={!collapsed}
			onOpenChange={(open) => setCollapsed(!open)}
			className="h-full min-h-0"
			data-testid="sidebar-provider"
		>
			<div
				className={cn("group relative flex h-full w-full flex-col bg-sidebar")}
				data-state={collapsed ? "collapsed" : "expanded"}
				data-collapsible={collapsed ? "icon" : ""}
				data-testid="sidebar"
			>
				<ShadcnSidebarHeader className="shrink-0 p-0" data-testid="sidebar-header">
					<MagicSidebarHeader collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
				</ShadcnSidebarHeader>
				<ShadcnSidebarContent
					className="min-h-0 flex-1 gap-0 overflow-y-auto overflow-x-hidden p-0 pb-1"
					data-testid="sidebar-content"
				>
					<MagicSidebarContent collapsed={collapsed} />
				</ShadcnSidebarContent>
				<Divider direction="horizontal" className="mx-auto !w-[calc(100%-16px)]" />
				<ShadcnSidebarFooter className="shrink-0 p-0" data-testid="sidebar-footer">
					<MagicSidebarFooter collapsed={collapsed} />
				</ShadcnSidebarFooter>
			</div>
		</SidebarProvider>
	)
})

export default MagicSidebar
