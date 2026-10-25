import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { MobileShellSidebarToggleButton } from "@/pages/superMagicMobile/components/MobileShell"
import { usePoppinsFont } from "@/styles/font"

interface ChatPageHeaderProps {
	/** Open-only fallback when this header renders outside `SuperMobileShellRouteLayout`. */
	onMenuClick?: () => void
}

function ChatPageHeader({ onMenuClick }: ChatPageHeaderProps) {
	const { t } = useTranslation("super")
	const { t: tCommon } = useTranslation("common")
	const brandName = tCommon("platform.name") || t("mobile.shell.brandName")
	// 标题沿用原型里的 Poppins 字体节奏，避免首页品牌感与欢迎区不一致。
	usePoppinsFont([400])
	// 顶部安全区沿用移动端一级页的统一补偿方式，避免刘海屏下 header 视觉过重或按钮贴边。

	return (
		<div className="mobile-page-header pb-0" data-testid="chat-page-header-root">
			<MobileShellSidebarToggleButton onFallbackOpen={onMenuClick} />

			{/* 标题改为绝对居中，避免右侧 loading 与禁用态切换时品牌名左右跳动。 */}
			<h1 className="mobile-page-header-title">{brandName}</h1>
		</div>
	)
}

export default observer(ChatPageHeader)
