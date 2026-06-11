import { memo, useMemo, useRef, useState } from "react"
import { useAppearance } from "@/context/AppearanceProvider"
import {
	CheckboxOptions,
	type RenderListItemRight,
	TreeNode,
} from "@/components/UserSelector/types"
import SearchContainer from "@/components/SearchContainer"
import CommonListPanel from "@/components/CommonListPanel"
import { debounce } from "lodash-es"
import BasePopup from "@/components/BasePopup"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface SelectedPopupProps {
	/** 已选数据 */
	selected: TreeNode[]
	/** 已选/禁选 */
	checkboxOptions: CheckboxOptions<TreeNode>
	/** 完成回调 */
	onOk: () => void
	/** 控制抽屉打开状态 (新API) */
	open?: boolean
	/** 控制抽屉打开状态 (antd-mobile API) */
	visible?: boolean
	/** 抽屉状态变化回调 (新API) */
	onOpenChange?: (open: boolean) => void
	/** 抽屉关闭回调 (antd-mobile API) */
	onClose?: () => void
	/** 抽屉位置 (antd-mobile API) */
	position?: "bottom" | "top" | "left" | "right"
	/* 抽屉层级 */
	zIndex?: number
	/** 自定义抽屉内容类名 */
	bodyClassName?: string
	/** 自定义抽屉内容类名 */
	className?: string
	/** 关闭时是否销毁内容 */
	destroyOnClose?: boolean
	/** 自定义渲染列表项右侧内容 */
	renderItemRight?: RenderListItemRight
}

const SelectedPopup = ({
	selected,
	checkboxOptions,
	bodyClassName,
	className,
	open,
	visible,
	onOpenChange,
	onClose,
	position,
	zIndex,
	destroyOnClose,
	renderItemRight,
	onOk,
}: SelectedPopupProps) => {
	const { getLocale } = useAppearance()
	const locale = getLocale()

	const [searchValue, setSearchValue] = useState<string>()
	const [loading, setLoading] = useState(false)

	const debouncedSearch = useRef(
		debounce((value: string) => {
			setSearchValue(value)
			setLoading(false)
		}, 800),
	).current

	const onSearchChange = (value: string) => {
		setLoading(true)
		debouncedSearch(value)
	}

	const searchData = useMemo(() => {
		if (!searchValue)
			return {
				items: selected,
			}
		return {
			items: selected.filter((item) => item.name.includes(searchValue)),
		}
	}, [searchValue, selected])

	return (
		<BasePopup
			data-testid="mobile-user-selector-selected-popup"
			open={open}
			visible={visible}
			onOpenChange={onOpenChange}
			onClose={onClose}
			position={position}
			zIndex={zIndex}
			destroyOnClose={destroyOnClose}
			className="h-[80vh]"
			bodyClassName={cn("w-full h-full max-h-[90vh] rounded-t-lg", bodyClassName)}
			title={locale.selectedTitle}
		>
			<div
				className={cn("flex flex-col h-full", className)}
				data-testid="mobile-user-selector-selected-popup-content"
			>
				<div className="flex h-[50px] items-center px-3.5 text-sm">
					<Button
						variant="ghost"
						className="p-1 text-foreground"
						onClick={onClose}
						data-testid="mobile-user-selector-selected-popup-cancel-button"
					>
						{locale.cancel}
					</Button>
					<div className="flex-1 text-center text-base font-semibold leading-[22px] text-foreground">
						{locale.selectedTitle}
					</div>
					<Button
						variant="ghost"
						className="p-1 text-foreground"
						onClick={onOk}
						data-testid="mobile-user-selector-selected-popup-ok-button"
					>
						{locale.finish}
					</Button>
				</div>
				<SearchContainer
					data-testid="mobile-user-selector-selected-popup-search"
					searchData={searchData}
					loading={loading}
					placeholder={locale.searchDepartmentOrMember}
					onSearchChange={onSearchChange}
					renderItemRight={renderItemRight}
					isMobile
				>
					<CommonListPanel<TreeNode>
						data-testid="mobile-user-selector-selected-popup-list"
						list={selected}
						loading={loading}
						checkboxOptions={checkboxOptions}
						isMobile
						renderItemRight={renderItemRight}
					/>
				</SearchContainer>
			</div>
		</BasePopup>
	)
}

export default memo(SelectedPopup)
