import { memo } from "react"
import {
	AppearanceProvider,
	type LocaleType,
	MobileUserSelector,
	type MobileUserSelectorProps,
} from "@dtyq/user-selector"
import { useGlobalLanguage, useTheme } from "@/models/config/hooks"
import { useMemberDepartmentSelector } from "../MemberDepartmentSelector/hooks/useSelector"
import { CommonProps } from "../MemberDepartmentSelector"

export type MobileMemberDepartmentSelectorProps = Omit<
	MobileUserSelectorProps,
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

const MobileMemberDepartmentSelector = ({
	useAuthPanel = false,
	onlyDepartment = false,
	isConvertToUser = false,
	segmentOptions,
	onOk,
	onCancel,
	...props
}: MobileMemberDepartmentSelectorProps) => {
	const { prefersColorScheme: theme } = useTheme()
	const language = useGlobalLanguage(false)

	const {
		ref,
		open,
		isLoading,
		isSearching,
		dataArray,
		searchResults,
		organizationInfo,
		segmentData,
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
	})

	return (
		<AppearanceProvider theme={theme} language={language as LocaleType}>
			<MobileUserSelector
				ref={ref}
				visible={open}
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
				bodyClassName="max-h-[85vh]"
				{...props}
			/>
		</AppearanceProvider>
	)
}
export default memo(MobileMemberDepartmentSelector)
