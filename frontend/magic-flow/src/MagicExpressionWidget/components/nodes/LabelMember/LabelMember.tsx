import { checkIsReferenceNode } from "@/MagicExpressionWidget/helpers"
import { EXPRESSION_ITEM, WithReference } from "@/MagicExpressionWidget/types"
import { useMemoizedFn } from "ahooks"
import React, { useState } from "react"
import useDatasetProps from "../../hooks/useDatasetProps"
import useDeleteReferenceNode from "../../hooks/useDeleteReferenceNode"
import { LabelNode } from "../LabelNode/LabelNode"
import MemberItem from "./MemberSelect/components/MemberItem/MemberItem"
import "./index.less"
import { Member } from "./types"

interface LabelMemberProps {
	config: EXPRESSION_ITEM
	updateFn: (val: EXPRESSION_ITEM) => void
	wrapperWidth: number
}

export default function LabelMember({ config, updateFn, wrapperWidth }: LabelMemberProps) {
	const { datasetProps } = useDatasetProps({ config })

	const [multipleValue, setMultipleValue] = useState(
		config.member_value as WithReference<Member>[],
	)

	const onDeleteCurrentItem = useMemoizedFn((id: string) => {
		const index = multipleValue.findIndex((v) => v.id === id)
		if (index === -1) return
		multipleValue.splice(index, 1)
		setMultipleValue([...multipleValue])
		updateFn({
			...config,
			multiple_value: multipleValue,
		})
	})

	const { onDeleteReferenceNode } = useDeleteReferenceNode({
		values: multipleValue,
		setValues: setMultipleValue,
		config,
		updateFn,
		valueName: "member_value",
	})

	return (
		<>
			{config?.member_value?.map((val: WithReference<Member>) => {
				const isReference = checkIsReferenceNode(val)
				if (isReference)
					return (
						<LabelNode
							selected={false}
							config={val as EXPRESSION_ITEM}
							deleteFn={onDeleteReferenceNode}
							wrapperWidth={wrapperWidth}
						/>
					)
				return (
					<MemberItem
						className="magic-label-member"
						item={val as Member}
						itemClick={() => {}}
						showCheck={false}
						size={18}
						value={config?.member_value}
						onDelete={() => onDeleteCurrentItem(val.id)}
						{...datasetProps}
					/>
				)
			})}
		</>
	)
}
