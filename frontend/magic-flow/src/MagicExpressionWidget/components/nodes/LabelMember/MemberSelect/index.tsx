import { useDebounceFn, useMemoizedFn } from "ahooks"
import i18next from "i18next"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { Member } from "../types"
import Select, { MemberSelectProps, MemberType } from "./Select"

const MemberSelect = ({
	value,
	onChange,
	size,
	isMultiple = true,

	// 是否显示人员/部门切换器
	showMemberType = false,

	// 成员类型,
	searchType,
	setSearchType,

	// 是否只能选择自己
	onlyMyself = false,

	onSearch,

	options: memberOptions,
}: MemberSelectProps & {
	onlyMyself?: boolean
}) => {
	const { t } = useTranslation()
	const [options, setOptions] = useState(memberOptions as Member[])

	const { run: onMemberSearch } = useDebounceFn(
		useMemoizedFn(async (val) => {
			if (!val) return setOptions([])
			let results = [] as Member[]

			// 只能选自己，则不走异步逻辑
			if (onlyMyself) return
			try {
				const isDepartment = searchType === MemberType.Department
				const data = await onSearch({
					with_department: isDepartment ? 1 : 0,
					name: val,
				})
				if (Array.isArray(data)) {
					results = data as Member[]
				}
			} catch (e) {
				console.error(e)
				results = [] as Member[]
			}

			setOptions(results)
		}),
		{ wait: 500 },
	)

	// useEffect(() => {
	// 	if (!onlyMyself) return
	// 	setOptions([{ ...userInfo, type: MemberType.User, value: userInfo.id }])
	// 	return
	// }, [userInfo, onlyMyself])

	// useUpdateEffect(() => {
	// 	if (onlyMyself) {
	// 		setOptions([{ ...userInfo, type: MemberType.User, value: userInfo.id }])
	// 		return
	// 	}
	// 	setOptions([])
	// }, [searchType, onlyMyself])

	return (
		<Select
			value={value}
			options={options}
			onChange={onChange}
			isMultiple={isMultiple}
			filterOption={false}
			onSearch={onMemberSearch}
			size={size}
			placeholder={i18next.t("common.pleaseSelect", { ns: "magicFlow" })}
			showMemberType={showMemberType}
			setSearchType={setSearchType}
			searchType={searchType}
		/>
	)
}

export default MemberSelect
