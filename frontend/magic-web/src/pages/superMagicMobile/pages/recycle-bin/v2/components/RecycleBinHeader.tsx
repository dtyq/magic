import { memo } from "react"
import { ListFilter } from "lucide-react"
import { useTranslation } from "react-i18next"
import { MobileShellSidebarToggleButton } from "@/pages/superMagicMobile/components/MobileShell"

interface RecycleBinHeaderProps {
	onFilterClick: () => void
	/** 预留：自顶栏展开搜索（当前 v2 使用底部搜索条，可不传） */
	isSearchOpen?: boolean
	searchValue?: string
	onSearchOpen?: () => void
	onSearchCancel?: () => void
	onSearchValueChange?: (value: string) => void
}

/**
 * 顶栏：菜单由外层 `MobileShell` 打开侧栏；不在此重复实现侧栏内容。
 */
function RecycleBinHeader(props: RecycleBinHeaderProps) {
	const { isSearchOpen = false, onFilterClick } = props

	const { t } = useTranslation("super")

	if (isSearchOpen) return null

	return (
		<div className="mobile-page-header" data-testid="mobile-recycle-bin-header">
			<MobileShellSidebarToggleButton testId="mobile-recycle-bin-menu-button" />

			<div className="min-w-0 flex-1 px-2 text-center" data-testid="mobile-recycle-bin-title">
				<h1 className="truncate font-poppins text-[19px] font-semibold tracking-tight text-foreground">
					{t("mobile.recycleBin.title")}
				</h1>
			</div>

			<button
				type="button"
				onClick={onFilterClick}
				className="mobile-page-header-btn transition-transform active:scale-95"
				aria-label={t("mobile.recycleBin.filterSheet.openAria")}
				data-testid="mobile-recycle-bin-filter-open"
			>
				<ListFilter className="size-[22px] text-foreground" />
			</button>
		</div>
	)
}

export default memo(RecycleBinHeader)
