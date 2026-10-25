import type { ReactNode } from "react"
import { SidebarMenu } from "@/components/shadcn-ui/sidebar"
import { HomeOnboardingAnchor } from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"

/** 首页位于滚动区域之外，应用和项目共享下方的导航视口。 */
function SidebarContentLayout({ home, children }: { home: ReactNode; children: ReactNode }) {
	return (
		<>
			<div className="flex shrink-0 items-center px-2 pt-2">
				{/*
				 * 侧栏导览第一步挂在下方能力列表上，但这一步讲的是整个左侧导航，所以
				 * 「新建任务 / 新建对话」这块也发布成伴随锚点，由引导取两者的并集来框。
				 */}
				<SidebarMenu
					className="min-w-0 flex-1"
					data-guide-anchor={HomeOnboardingAnchor.SidebarHomeActions}
				>
					{home}
				</SidebarMenu>
			</div>
			{children}
		</>
	)
}

export default SidebarContentLayout
