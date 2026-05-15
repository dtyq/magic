import { memo } from "react"
import { ListFilter, Menu } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"

interface RecycleBinHeaderProps {
	onMenuClick: () => void
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
 * TODO(mobile-refactor-cleanup): 与 WP40 主导航侧栏合并时，仅替换 onMenuClick 注入来源。
 */
function RecycleBinHeader(props: RecycleBinHeaderProps) {
	const { isSearchOpen = false, onMenuClick, onFilterClick } = props

	const { t } = useTranslation("super")

	if (isSearchOpen) return null

	return (
		<div
			className="relative z-10 flex h-[calc(56px+var(--safe-area-inset-top))] shrink-0 items-center gap-1 px-4 pb-3 pt-[calc(var(--safe-area-inset-top)+8px)]"
			data-testid="mobile-recycle-bin-header"
		>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="h-11 w-11 shrink-0 rounded-full border border-border/10 bg-background shadow-[0px_4px_12px_rgba(0,0,0,0.06)] transition-transform active:scale-95"
				onClick={onMenuClick}
				aria-label={t("mobile.shell.menuAria")}
				data-testid="mobile-recycle-bin-menu-button"
			>
				<Menu className="size-6 text-foreground" strokeWidth={2.25} />
			</Button>

			<div className="min-w-0 flex-1 px-2 text-center" data-testid="mobile-recycle-bin-title">
				<h1 className="truncate font-poppins text-[19px] font-semibold tracking-tight text-foreground">
					{t("mobile.recycleBin.title")}
				</h1>
			</div>

			<div className="flex shrink-0 items-center gap-1">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-11 w-11 rounded-full border border-border/10 bg-background shadow-[0px_4px_12px_rgba(0,0,0,0.06)] transition-transform active:scale-95"
					onClick={onFilterClick}
					aria-label={t("mobile.recycleBin.filterSheet.openAria")}
					data-testid="mobile-recycle-bin-filter-open"
				>
					<ListFilter className="size-6 text-foreground" strokeWidth={2.25} />
				</Button>
			</div>
		</div>
	)
}

export default memo(RecycleBinHeader)
