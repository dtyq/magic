import { forwardRef, memo, useImperativeHandle, useMemo, useRef, useState } from "react"
import type { ForwardRefRenderFunction } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { MobileList, MobileListItem } from "@/components/ui/mobile-list"
import { cn } from "@/lib/utils"
import { useAppearance } from "@/context/AppearanceProvider"
import SearchContainer from "../SearchContainer"
import useSegment, { useCheckSelect } from "@/hooks/useUserSelect"
import IconAvatar from "../IconAvatar"
import {
	CheckboxOptions,
	SegmentType,
	TreeNode,
	CommonSelectorProps,
	NodeType,
	SelectedPath,
	UserSelectorRef,
} from "../UserSelector/types"
import { IconChevronRight, IconChevronUp } from "@tabler/icons-react"
import { useControllableValue } from "ahooks"
import MobileListComponent from "./components/MobileList"
import { groupBy } from "lodash-es"
import SelectedPopup from "./components/SelectedPopup"
import BasePopup from "../BasePopup"

export interface MobileUserSelectorProps extends Partial<CommonSelectorProps> {
	title?: string
	visible?: boolean
	onClose?: () => void
	onMaskClick?: () => void
	/* 安全区域顶部 */
	safeAreaTop?: string
	/* 安全区域底部 */
	safeAreaBottom?: string
	/* 已选弹窗配置 */
	selectedPopupProps?: Record<string, unknown>
	bodyClassName?: string
	className?: string
	[key: string]: unknown
}

const MobileUserSelector: ForwardRefRenderFunction<UserSelectorRef, MobileUserSelectorProps> = (
	{
		data,
		loading,
		title,
		disabledValues,
		maxCount = 0,
		bodyClassName,
		segmentData,
		organization,
		searchData,
		disableUser = false,
		safeAreaBottom,
		onClose,
		onItemClick,
		onOk,
		onSearchChange,
		selectedPopupProps,
		visible,
		className: _className,
		...props
	},
	ref,
) => {
	const { getLocale } = useAppearance()
	const locale = getLocale()

	const { SegmentOption } = useSegment(segmentData)

	// 是否打开已选列表
	const [popupVisible, setPopupVisible] = useState(false)
	// 分段类型
	const [segment, setSegment] = useState<SegmentType | null>(null)
	// 搜索值
	const [searchValue, setSearchValue] = useState<string>("")

	const onSegmentChange = (value: SegmentType | null) => {
		setSegment(value)
	}

	const [selected, setSelected] = useControllableValue<TreeNode[]>(props, {
		defaultValue: [],
		valuePropName: "selectedValues",
		trigger: "onSelectChange",
		defaultValuePropName: "initialSelectValues",
	})

	const [selectedPath, setSelectedPath] = useControllableValue<SelectedPath[]>(props, {
		defaultValue: [],
		defaultValuePropName: "defaultSelectedPath",
		valuePropName: "selectedPath",
		trigger: "onBreadcrumbClick",
	})

	const organizationCheckboxOptions = useMemo<CheckboxOptions<TreeNode>>(
		() => ({
			checked: selected,
			onChange: setSelected,
			disabled: disabledValues,
		}),
		[selected, setSelected, disabledValues],
	)

	const pathOptions = useMemo<CheckboxOptions<SelectedPath>>(
		() => ({
			checked: selectedPath,
			onChange: setSelectedPath,
		}),
		[selectedPath, setSelectedPath],
	)

	const onCancel = () => {
		setSegment(null)
		setSelected([])
		onClose?.()
	}

	const {
		[NodeType.Department]: departmentSelected = [],
		[NodeType.User]: userSelected = [],
		[NodeType.Group]: groupSelected = [],
		[NodeType.Partner]: partnerSelected = [],
		[NodeType.UserGroup]: userGroupSelected = [],
	} = useMemo(() => {
		return groupBy(selected, (item: TreeNode) => item.dataType)
	}, [selected])

	// 优化选中项显示逻辑
	const getSelectedText = useMemo(() => {
		if (selected.length === 0) return null

		// 定义选中项配置
		const selectedTypes = [
			{
				items: departmentSelected,
				text: locale.selectedDepartment,
			},
			{
				items: userSelected,
				text: locale.selectedUser,
			},
			{
				items: groupSelected,
				text: locale.selectedGroup,
			},
			{
				items: partnerSelected,
				text: locale.selectedPartner,
			},
			{
				items: userGroupSelected,
				text: locale.selectedUserGroup,
			},
		]

		// 找到唯一有选中项的类型
		const selectedTypeConfigs = selectedTypes.filter((type) => type.items.length > 0)

		if (selectedTypeConfigs.length === 1) {
			const config = selectedTypeConfigs[0]
			return config.text
		}

		return null
	}, [
		selected,
		userSelected,
		departmentSelected,
		groupSelected,
		partnerSelected,
		userGroupSelected,
		locale,
	])

	// 当前所展示的数据
	const currentData = useMemo(() => {
		if (searchValue) return searchData?.items ?? []
		/* 没有分段数据，直接展示列表 */
		if (!segment) return data
		/* 分享至群聊，直接展示空数组 */
		if (segment === SegmentType.ShareToGroup) return []
		/* 离职人员，直接展示离职人员数据 */
		if (segment === SegmentType.Resigned) return segmentData?.[segment]?.items ?? []
		/* 用户组，直接展示用户组数据 */
		if (segment === SegmentType.UserGroup) return segmentData?.[segment]?.items ?? []
		/* 存在分段数据，直接展示分段数据 */
		return segmentData?.[segment] ?? []
	}, [searchValue, searchData?.items, segment, data, segmentData])

	const { handleCheckAll, checkAll, checkSome } = useCheckSelect({
		data: currentData || [],
		checkedList: selected,
		maxCount,
		disabledValues,
		setCheckedList: setSelected,
		disableUser,
	})

	// 提取公共的 MobileList props
	const getMobileListProps = () => ({
		loading,
		organization,
		data: data || [],
		maxCount,
		disableUser,
		checkboxOptions: organizationCheckboxOptions,
		pathOptions,
		onItemClick,
	})

	const renderContent = () => {
		const baseProps = getMobileListProps()

		// 没有分段数据，直接展示列表
		if (!segmentData) {
			return <MobileListComponent {...baseProps} />
		}

		// 存在分段数据，但未选择分段，展示分段面板
		if (!segment) {
			return (
				<MobileList>
					{SegmentOption.map((item) => (
						<MobileListItem
							key={item.value}
							onClick={() => onSegmentChange(item.value)}
							prefix={<IconAvatar name={item.label} icon={item.icon} />}
							arrowIcon={<IconChevronRight size={18} stroke={1.5} />}
						>
							{item.label2}
						</MobileListItem>
					))}
				</MobileList>
			)
		}

		// 存在分段数据，且已选择分段，展示列表
		return (
			<MobileListComponent
				{...baseProps}
				segment={segment}
				updateSegment={onSegmentChange}
				segmentData={segmentData}
			/>
		)
	}

	// 内部搜索框事件
	const innerOnSearchChange = (value: string) => {
		setSearchValue(value)
		onSearchChange?.(value, segment)
	}

	const showSelectText = useMemo(() => {
		if (!segmentData || searchValue) return true
		if (segment) {
			return segment === SegmentType.ShareToGroup ? false : true
		}
		return false
	}, [segmentData, searchValue, segment])

	const searchContainerRef = useRef<UserSelectorRef>(null)

	useImperativeHandle(ref, () => ({
		clearSearchValue: () => {
			searchContainerRef.current?.clearSearchValue()
		},
	}))

	return (
		<>
			<BasePopup
				visible={visible}
				onClose={onClose}
				position="bottom"
				title={title ?? locale.defaultTitle}
				className="h-[90vh]"
				bodyClassName={cn("flex h-full flex-col", bodyClassName)}
			>
				<div className="flex h-full flex-col">
					<div className="flex h-[50px] items-center px-3.5 text-sm">
						<Button variant="ghost" className="p-1 text-foreground" onClick={onCancel}>
							{locale.cancel}
						</Button>
						<div className="flex-1 text-center text-base font-semibold leading-[22px] text-foreground">
							{title ?? locale.defaultTitle}
						</div>
						<Button
							variant="ghost"
							className="p-1 text-foreground"
							onClick={() => onOk?.(selected)}
						>
							{locale.finish}
						</Button>
					</div>

					<SearchContainer
						ref={searchContainerRef}
						searchValue={searchValue}
						placeholder={locale.searchDepartmentOrMember}
						searchData={searchData}
						loading={loading}
						checkboxOptions={organizationCheckboxOptions}
						onSearchChange={innerOnSearchChange}
						maxCount={maxCount}
						disableUser={disableUser}
						isMobile
						showSearch={segment !== SegmentType.ShareToGroup}
					>
						{renderContent()}
					</SearchContainer>

					{showSelectText && (
						<div
							className="text-foreground-secondary flex h-11 w-full items-center justify-between self-end border-t border-border px-3.5 py-1.5 text-sm"
							style={{
								paddingBottom: safeAreaBottom
									? `calc(${safeAreaBottom} + 6px)`
									: "6px",
							}}
						>
							<Checkbox
								checked={checkAll || checkSome ? "indeterminate" : false}
								onCheckedChange={(checked) => {
									handleCheckAll(checked === true)
								}}
								className="shrink-0"
							>
								<span className="ml-1">{locale.selectAllOrNone}</span>
							</Checkbox>

							<div
								className={cn(
									"flex items-center justify-end gap-0.5 self-end w-full h-full cursor-pointer",
									selected.length > 0 ? "text-primary" : "text-muted-foreground",
								)}
								onClick={() => setPopupVisible(true)}
							>
								<span>{locale.selected}</span>
								<span>{selected.length}</span>
								{getSelectedText && <span>{getSelectedText}</span>}
								<IconChevronUp size={14} stroke={1.5} />
							</div>
						</div>
					)}
				</div>
			</BasePopup>
			<SelectedPopup
				selected={selected}
				visible={popupVisible}
				onClose={() => setPopupVisible(false)}
				onOk={() => setPopupVisible(false)}
				checkboxOptions={organizationCheckboxOptions}
				{...selectedPopupProps}
			/>
		</>
	)
}

export default memo(forwardRef(MobileUserSelector))
