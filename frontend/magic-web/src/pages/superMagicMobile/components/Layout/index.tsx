import { type PropsWithChildren } from "react"
import { observer } from "mobx-react-lite"

export interface SuperMagicMobileLayoutRef {
	closeNavigatePopup: () => void
}

interface SuperMagicMobileLayoutProps extends PropsWithChildren {
	header?: React.ReactNode
}

/**
 * 超级麦吉移动端主布局：固定顶部 MainHeader，下方 Outlet 区域可滚动；高度用 flex 分配以适配不同头部高度。
 */
function SuperMagicMobileLayout(props: PropsWithChildren<SuperMagicMobileLayoutProps>) {
	const { header, children } = props

	return (
		<>
			{/* 主内容区用 flex-1 + min-h-0 吃满头部以下的剩余高度，避免写死 50px 与 ProjectDetailHeader(56px) 不一致时露出壳层底色或裁切内容 */}
			<div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
				{header}
				<div className="min-h-0 flex-1 overflow-hidden">{children}</div>
			</div>
		</>
	)
}

export default observer(SuperMagicMobileLayout)
