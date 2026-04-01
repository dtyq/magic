import type { ChangeEvent, PropsWithChildren, Ref } from "react"
import { forwardRef, memo, useImperativeHandle, useState } from "react"
import { IconSearch, IconX } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { BaseProps, TreeNode, CheckboxOptions, Pagination } from "../UserSelector/types"
import CommonListPanel from "../CommonListPanel"
import { useAppearance } from "@/context/AppearanceProvider"
import { Input } from "@/components/ui/input"

export interface SearchContainerProps extends PropsWithChildren, BaseProps {
	/* 是否加载中 */
	loading?: boolean
	/** 搜索值 */
	searchValue?: string
	/** 搜索数据 */
	searchData?: Pagination<TreeNode>
	/* 搜索框占位符 */
	placeholder?: string
	/** 最大可选人数 */
	maxCount?: number
	/** 已选/禁选 */
	checkboxOptions?: CheckboxOptions<TreeNode>
	/** 是否是移动端 */
	isMobile?: boolean
	/** 是否禁选用户 */
	disableUser?: boolean
	/** 是否显示搜索框 */
	showSearch?: boolean
	/* 搜索框事件 */
	onSearchChange?: (value: string) => void
}

export interface SearchContainerRef {
	clearSearchValue: () => void
}

function SearchContainer(
	{
		searchValue: searchValueProps,
		children,
		loading,
		placeholder,
		searchData,
		style,
		className,
		maxCount,
		checkboxOptions,
		isMobile = false,
		disableUser = false,
		showSearch = true,
		onSearchChange,
	}: SearchContainerProps,
	ref: Ref<SearchContainerRef>,
) {
	const [searchValue, setSearchValue] = useState(searchValueProps ?? "")

	const { getLocale } = useAppearance()
	const locale = getLocale()

	const onChange = (e: ChangeEvent<HTMLInputElement>) => {
		setSearchValue(e.target.value)
		onSearchChange?.(e.target.value)
	}

	const clearValue = () => {
		setSearchValue("")
		onSearchChange?.("")
	}

	useImperativeHandle(ref, () => ({
		clearSearchValue: () => {
			setSearchValue("")
			onSearchChange?.("")
		},
	}))

	return (
		<div
			style={style}
			className={cn(
				"flex flex-col gap-1.5 overflow-hidden",
				isMobile ? "w-full h-full p-2.5" : "w-full h-full p-3",
				className,
			)}
		>
			{showSearch && (
				<div className="relative shrink-0">
					<IconSearch
						size={16}
						className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						className={cn(
							"w-full h-9",
							"pl-9 pr-9 rounded-lg border border-input bg-background text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring",
						)}
						placeholder={placeholder ?? locale.search}
						value={searchValue}
						onChange={onChange}
					/>
					{searchValue && (
						<button
							type="button"
							onClick={clearValue}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						>
							<IconX size={14} />
						</button>
					)}
				</div>
			)}
			<div className="min-h-0 flex-1 overflow-hidden">
				{searchValue ? (
					<CommonListPanel<TreeNode>
						loading={loading}
						list={searchData?.items}
						hasMore={searchData?.hasMore}
						loadMore={searchData?.loadMore}
						checkboxOptions={checkboxOptions}
						maxCount={maxCount}
						isMobile={isMobile}
						disableUser={disableUser}
					/>
				) : (
					children
				)}
			</div>
		</div>
	)
}

export default memo(forwardRef(SearchContainer))
