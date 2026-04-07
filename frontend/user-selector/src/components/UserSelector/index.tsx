import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import type { Ref } from "react"
import {
	type UserSelectorProps,
	type TreeNode,
	type CheckboxOptions,
	type User,
	SegmentType,
	OperationTypes,
	Group,
	Partner,
	Resigned,
	SelectedPath,
	UserSelectorRef,
} from "./types"
import { cn } from "@/lib/utils"
import { useControllableValue, useMemoizedFn, useMount } from "ahooks"
import SearchContainer from "../SearchContainer"
import OrganizationPanel from "../OrganizationPanel"
import SelectedPanel from "../SelectedPanel"
import CommonListPanel from "../CommonListPanel"
import { useAppearance } from "@/context/AppearanceProvider"
import useSegment from "@/hooks/useUserSelect"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Segmented } from "@/components/ui/segmented"
import { Button } from "@/components/ui/button"

function UserSelector(props: UserSelectorProps, ref: Ref<UserSelectorRef>) {
	const {
		open,
		title,
		classNames: modalClassNames,
		style,
		loading,
		organization,
		data,
		searchData,
		checkbox = true,
		disabledValues,
		useAuthPanel,
		leftClassName,
		rightClassName,
		cancelText,
		okText,
		segmentData,
		maxCount = 0,
		disableUser = false,
		onCancel,
		onOk,
		onSearchChange,
		onItemClick,
		renderRight,
		renderRightTop,
		renderRightBottom,
		renderRightBySegment,
		onOpenChange,
	} = props

	const { getLocale, theme } = useAppearance()
	const locale = getLocale()

	const [segment, setSegment] = useState<SegmentType>()

	const { SegmentOption } = useSegment(segmentData, false)

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

	const searchContainerRef = useRef<UserSelectorRef>(null)

	useImperativeHandle(ref, () => ({
		clearSearchValue: () => {
			searchContainerRef.current?.clearSearchValue()
		},
	}))

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
			onChange: (value) => setSelectedPath(value, segment),
		}),
		[selectedPath, setSelectedPath, segment],
	)

	const onTagClose = (value: TreeNode) => {
		setSelected((prev) => {
			return prev.filter((i) => i.dataType !== value.dataType || i.id !== value.id)
		})
	}

	/* 组织架构面板 */
	const defaultOrganizationPanel = useMemoizedFn(
		(seg?: SegmentType.Organization | SegmentType.ShareToMember | SegmentType.UserGroup) => {
			let innerData = data
			if (seg === SegmentType.UserGroup) {
				innerData = segmentData?.[seg]?.items ?? []
			} else if (seg === SegmentType.ShareToMember || seg === SegmentType.Organization) {
				innerData = segmentData?.[seg] ?? data
			}

			const otherOptions =
				seg === SegmentType.UserGroup
					? {
							hasMore: segmentData?.[seg]?.hasMore,
							loadMore: segmentData?.[seg]?.loadMore,
						}
					: {}

			return (
				<OrganizationPanel
					data={innerData}
					loading={loading}
					checkbox={checkbox}
					maxCount={maxCount}
					organization={organization}
					checkboxOptions={organizationCheckboxOptions}
					pathOptions={pathOptions}
					disableUser={disableUser}
					onItemClick={(node) => onItemClick?.(node, seg)}
					{...otherOptions}
				/>
			)
		},
	)

	/* 渲染分段选择器 */
	const renderSegment = useMemoizedFn(() => {
		if (!segmentData) return null
		switch (segment) {
			case SegmentType.Recent:
			case SegmentType.Group:
			case SegmentType.Partner:
				return (
					<CommonListPanel<Group | Partner | User>
						loading={loading}
						list={segmentData[segment]}
						checkboxOptions={organizationCheckboxOptions}
						maxCount={maxCount}
						disableUser={disableUser}
					/>
				)
			case SegmentType.Resigned:
				return (
					<CommonListPanel<Resigned>
						loading={loading}
						list={segmentData?.[segment]?.items}
						checkboxOptions={organizationCheckboxOptions}
						maxCount={maxCount}
						hasMore={segmentData?.[segment]?.hasMore}
						loadMore={segmentData?.[segment]?.loadMore}
						disableUser={disableUser}
						onItemClick={(node) => onItemClick?.(node, segment)}
					/>
				)
			case SegmentType.Organization:
			case SegmentType.ShareToMember:
			case SegmentType.UserGroup:
				return defaultOrganizationPanel(segment)
			case SegmentType.ShareToGroup:
				return segmentData?.[segment]
			default:
				return defaultOrganizationPanel()
		}
	})

	// 当启用权限面板时，确保选中的数据包含必要的字段
	useEffect(() => {
		if (useAuthPanel && open) {
			// 检查选中的数据是否都包含 operation 字段
			let missingOperation = false
			missingOperation = selected.some((item) => item?.operation === undefined)

			// 检查选中的数据是否都包含 operation 字段
			if (missingOperation) {
				// message.warning("权限面板功能需要数据包含 operation 字段")

				// 为缺少 operation 字段的项添加默认值
				setSelected((prev) =>
					prev.map(
						(item) =>
							({
								...item,
								operation: item?.operation ?? OperationTypes.Read, // 默认为只读权限
								canEdit: item?.canEdit ?? true, // 默认可编辑
							}) as TreeNode,
					),
				)
			}
		}
	}, [open, useAuthPanel, selected, setSelected, SegmentOption, data])

	// 内部搜索框事件
	const innerOnSearchChange = (value: string) => {
		onSearchChange?.(value, segment)
	}

	// 内部分段选择器事件
	const onSegmentChange = (value: string | number) => {
		const segmentValue = value as SegmentType
		setSegment(segmentValue)
		setSelectedPath([], segmentValue)
	}

	useMount(() => {
		if (segmentData) {
			const keys = Object.keys(segmentData)
			if (keys.length > 0) {
				setSegment(keys[0] as SegmentType)
			}
		}
	})

	const handleOpenChange = (isOpen: boolean) => {
		onOpenChange?.(isOpen)
		if (!isOpen) {
			onCancel?.()
		}
	}

	const handleReset = () => {
		setSelected([])
		setSelectedPath([], segment)
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className={cn(
					"selector max-w-[860px] h-[600px] p-0 flex flex-col overflow-hidden gap-0 border-border",
					modalClassNames?.content,
				)}
				style={style}
				data-theme={theme}
			>
				<DialogHeader
					className={cn(
						"px-3 py-3 mb-0 border-b border-border flex flex-row items-center justify-between",
						modalClassNames?.header,
					)}
				>
					<DialogTitle className="text-base font-semibold text-foreground">
						{title ?? locale.defaultTitle}
					</DialogTitle>
				</DialogHeader>
				<div className="flex min-h-0 flex-1">
					<SearchContainer
						ref={searchContainerRef}
						onSearchChange={innerOnSearchChange}
						searchData={searchData}
						loading={loading}
						className={cn("w-[430px]", leftClassName)}
						checkboxOptions={organizationCheckboxOptions}
						maxCount={maxCount}
						disableUser={disableUser}
						showSearch={segment !== SegmentType.ShareToGroup}
					>
						{segmentData ? (
							<div className="flex h-full flex-col gap-1.5 overflow-hidden">
								<Segmented
									block
									options={SegmentOption}
									value={segment}
									onChange={onSegmentChange}
									className="rounded bg-accent p-0.5"
								/>
								<div className="flex-1 overflow-hidden">{renderSegment()}</div>
							</div>
						) : (
							defaultOrganizationPanel()
						)}
					</SearchContainer>
					<div className="h-full w-px bg-border" />
					{/* 自定义渲染 */}
					{renderRight
						? // 全局自定义渲染 - 完全覆盖右侧内容
							renderRight(selected)
						: // 自定义渲染特定分段类型的右侧内容
							(renderRightBySegment?.(selected, segment) ?? (
								// 使用默认的SelectedPanel，支持局部自定义
								<SelectedPanel
									className={cn("flex-1 h-full overflow-hidden", rightClassName)}
									useAuthPanel={useAuthPanel}
									checkboxOptions={organizationCheckboxOptions}
									onClose={onTagClose}
									onCancel={onCancel}
									onOk={() => onOk?.(selected)}
									renderRightTop={renderRightTop}
									renderRightBottom={renderRightBottom}
									hideFooter
								/>
							))}
				</div>
				<div className="flex items-center justify-between border-t border-border p-3">
					<Button
						variant="outline"
						onClick={handleReset}
						className="h-9 rounded-md border-input bg-background px-4 text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
					>
						{locale.reset}
					</Button>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							onClick={onCancel}
							className="h-9 rounded-md border-input bg-background px-4 text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
						>
							{cancelText || locale.cancel}
						</Button>
						<Button
							variant="default"
							onClick={() => onOk?.(selected)}
							className="h-9 rounded-md bg-primary px-4 text-primary-foreground shadow-sm hover:bg-primary/90"
						>
							{okText || locale.ok}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}

const UserSelectorWithRef = forwardRef(UserSelector)
export default memo(UserSelectorWithRef)
