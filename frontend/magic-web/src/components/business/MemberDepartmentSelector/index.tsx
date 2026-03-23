import { memo } from "react"
import {
	type TreeNode,
	UserSelector,
	SegmentType,
	type UserSelectorProps,
	AppearanceProvider,
	MobileUserSelector,
	type LocaleType,
} from "@dtyq/user-selector"
import { useGlobalLanguage, useTheme } from "@/models/config/hooks"
import { useMemberDepartmentSelector } from "./hooks/useSelector"
import { useIsMobile } from "@/hooks/useIsMobile"
import { omit } from "lodash-es"

// 公共属性
export type CommonProps = {
	/** 只显示部门 */
	onlyDepartment?: boolean
	/** 是否将部门转换成人员 */
	isConvertToUser?: boolean
	/** 分段选择器 */
	segmentOptions?: SegmentType[]
	/** 确定回调 */
	onOk?: (selected: TreeNode[]) => void
	/** 取消回调 */
	onCancel?: () => void
	/** 是否过滤AI助理 */
	filterAgent?: boolean
	/** z-index */
	zIndex?: number
}

export type MemberDepartmentSelectorProps = Omit<
	UserSelectorProps,
	| "data"
	| "searchData"
	| "organization"
	| "checkbox"
	| "segmentData"
	| "onItemClick"
	| "onSearchChange"
	| "loading"
> &
	CommonProps

/**
 * 成员部门选择器【使用组建包@dtyq/user-selector】
 * @param isConvertToUser 是否将部门转换成人员
 * @param onOk 确定回调
 * @param onCancel 取消回调
 * @param props 其他属性，参考@dtyq/user-selector内UserSelectorProps
 */

const MemberDepartmentSelector = ({
	useAuthPanel,
	onlyDepartment = false,
	isConvertToUser = false,
	segmentOptions,
	onOk,
	onCancel,
	filterAgent = true,
	style,
	zIndex,
	...props
}: MemberDepartmentSelectorProps) => {
	const { prefersColorScheme: theme } = useTheme()
	const language = useGlobalLanguage(false)
	const isMobile = useIsMobile()

	const {
		ref,
		isLoading,
		isSearching,
		dataArray,
		searchResults,
		organizationInfo,
		segmentData,
		selectedPath,
		onItemClick,
		onBreadcrumbClick,
		onSearchChange,
		onInnerOk,
		onInnerCancel,
	} = useMemberDepartmentSelector({
		useAuthPanel,
		onlyDepartment,
		isConvertToUser,
		segmentOptions,
		onOk,
		onCancel,
		filterAgent,
		open: props.open,
	})

	if (isMobile) {
		return (
			<AppearanceProvider theme={theme} language={language as LocaleType}>
				<MobileUserSelector
					ref={ref}
					visible={props.open}
					loading={isLoading || isSearching}
					data={dataArray}
					searchData={searchResults}
					organization={organizationInfo}
					useAuthPanel={useAuthPanel}
					segmentData={segmentData}
					onOk={onInnerOk}
					onClose={onInnerCancel}
					onItemClick={onItemClick}
					onBreadcrumbClick={onBreadcrumbClick}
					onSearchChange={onSearchChange}
					selectedPath={selectedPath}
					bodyClassName="max-h-[85vh]"
					style={{ zIndex, ...style }}
					{...omit(props, ["title", "getContainer", "centered"])}
				/>
			</AppearanceProvider>
		)
	}

	return (
		<AppearanceProvider theme={theme} language={language as LocaleType}>
			<UserSelector
				ref={ref}
				open={props.open}
				loading={isLoading || isSearching}
				data={dataArray}
				searchData={searchResults}
				organization={organizationInfo}
				useAuthPanel={useAuthPanel}
				segmentData={segmentData}
				onOk={onInnerOk}
				onCancel={onInnerCancel}
				onItemClick={onItemClick}
				onBreadcrumbClick={onBreadcrumbClick}
				onSearchChange={onSearchChange}
				selectedPath={selectedPath}
				style={{ zIndex, ...style }}
				{...props}
			/>
		</AppearanceProvider>
	)
}
export default memo(MemberDepartmentSelector)
