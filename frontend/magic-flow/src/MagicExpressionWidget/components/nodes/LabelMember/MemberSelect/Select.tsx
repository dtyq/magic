import _ from "lodash"
import React, { useMemo, useRef } from "react"
import Options from "./Options"

import { useFlow } from "@/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useMemoizedFn } from "ahooks"
import i18next from "i18next"
import { Member } from "../types"
import "./styles/select.less"

export enum MemberType {
	User = "user",
	Department = "department",
}

export type MemberSelectProps = {
	options: Member[]
	value: Member[]
	onChange: (member: Member[]) => void
	placeholder?: string
	size?: "small" | "large"
	isMultiple?: boolean
	filterOption?: boolean | ((keyword: string, options: Member[]) => Member[])
	onSearch: Function
	showMemberType?: boolean // 是否显示部门/成员切换器
	searchType?: MemberType
	setSearchType?: Function
}

function MemberSelect({
	options,
	value,
	onChange,
	placeholder = i18next.t("expression.pleaseSelectMembers", { ns: "magicFlow" }),
	size,
	isMultiple = true,
	filterOption,
	onSearch,
	showMemberType,
	setSearchType,
	searchType,
	...props
}: MemberSelectProps) {
	const domRef = useRef<HTMLDivElement>(null)

	const { edges } = useFlow()
	const { currentNode } = useCurrentNode()

	const displayValue = useMemo(() => {
		return _.cloneDeep(value)
	}, [value, edges, currentNode])

	const itemClick = useMemoizedFn((val: Member) => {
		onChange([{ ...val, memberType: searchType }] as Member[])
	})

	return (
		<div className="magic-member-select">
			<Options
				{...{
					itemClick,
					parent: domRef,
					value: displayValue,
					options: options,
					filterOption: filterOption,
					onSearch: onSearch,
					...props,
				}}
			/>
		</div>
	)
}

export default MemberSelect
