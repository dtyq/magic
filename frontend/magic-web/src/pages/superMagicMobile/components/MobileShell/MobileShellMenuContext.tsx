import { createContext, useContext, type ComponentType, type ReactNode, type SVGProps } from "react"
import type { LucideIcon } from "lucide-react"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"

export type MobileShellMenuNavIcon = LucideIcon | ComponentType<SVGProps<SVGSVGElement>>

export interface MobileShellMenuNavItem {
	key: string
	icon: MobileShellMenuNavIcon
	label: string
}

export interface MobileShellMenuRecentItem {
	id: string
	title: string
	project?: ProjectListItem
	/** 项目当前正在运行（话题执行中），展示 Loader 图标 */
	inProgress: boolean
	/** 项目已置顶 */
	isPinned: boolean
	/** 自己创建的协作项目（tag=collaboration 且当前用户为 owner），展示蓝色协作图标 */
	isShared: boolean
	/** 非 owner 的协作项目或绑定工作区项目，展示灰色 shortcut 图标 */
	isLinked: boolean
	/** 是否为对话（属于 chat workspace，点击后导航到对话页而非普通项目详情） */
	isChatProject: boolean
}

export interface MobileShellMenuContextValue {
	activeView: string
	navItems: MobileShellMenuNavItem[]
	recentItems: MobileShellMenuRecentItem[]
	onNavigate: (key: string) => void
	onGoHome: () => void
	onRecentNavigate: (item: MobileShellMenuRecentItem) => void
	reloadRecentItems?: () => Promise<void>
}

const MobileShellMenuContext = createContext<MobileShellMenuContextValue | null>(null)

export function MobileShellMenuProvider({
	value,
	children,
}: {
	value: MobileShellMenuContextValue
	children: ReactNode
}) {
	return (
		<MobileShellMenuContext.Provider value={value}>{children}</MobileShellMenuContext.Provider>
	)
}

export function useMobileShellMenu(): MobileShellMenuContextValue {
	const ctx = useContext(MobileShellMenuContext)
	if (!ctx) {
		throw new Error("useMobileShellMenu must be used within a MobileShellMenuProvider")
	}
	return ctx
}
