/* eslint-disable react/react-in-jsx-scope */
import { PlusCircleFilled } from "@ant-design/icons"
import classname from "clsx"
import i18next from "i18next"
import _ from "lodash"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import type { CacheDictionary, ChangeRef, OptionsProps } from ".."
import { RELATION_LOGICS_MAP, posSeparator } from "../constants"
import { RelationGroupStyle } from "../style"
import { Expression } from "../types/expression"
import { RelationItem } from "./RelationItem"

const getNewPos = (pos: string, i: number) => {
	return pos ? `${pos}${posSeparator}${i}` : String(i)
}

interface RelationGroupProps {
	pos: string
	changeRef: React.MutableRefObject<ChangeRef>
	conditionData: Expression.Condition
	options: OptionsProps
	cacheDictionary: CacheDictionary
	readonly: boolean
}

export function RelationGroup({
	pos = "",
	changeRef,
	conditionData,
	options,
	cacheDictionary,
	readonly,
}: RelationGroupProps) {
	const [ops, setOps] = useState((conditionData as Expression.LogicNode).ops)

	// 当conditionData.ops变化时同步更新本地状态
	useEffect(() => {
		setOps((conditionData as Expression.LogicNode).ops)
	}, [(conditionData as Expression.LogicNode).ops])

	const isShowRelationSign = useMemo(() => {
		const conditionDataCopy = conditionData as Expression.LogicNode
		if (
			pos === "" &&
			conditionDataCopy?.children?.length === 1 &&
			!(conditionDataCopy?.children[0] as Expression.LogicNode)?.ops
		) {
			// 顶层
			return false
		}
		return true
	}, [conditionData, pos])

	const switchOpsSign = useCallback(() => {
		if (_.isEmpty(changeRef) || _.isEmpty(changeRef.current)) return
		// 立即更新本地状态，使UI响应更快
		setOps(ops === RELATION_LOGICS_MAP.AND ? RELATION_LOGICS_MAP.OR : RELATION_LOGICS_MAP.AND)
		// 同时更新实际数据
		changeRef.current.switchConditionItemLogic(pos)
	}, [changeRef, pos, ops])

	const handleAddConditionItem = useCallback(() => {
		if (_.isEmpty(changeRef) || _.isEmpty(changeRef.current)) return
		changeRef.current.addConditionItem(pos)
	}, [changeRef, pos])

	const memoGroupList = useMemo(() => {
		return (
			(conditionData as Expression.LogicNode)?.children &&
			(conditionData as Expression.LogicNode).children.map((item, i) => {
				const newPos = getNewPos(pos, i)
				// console.log("newPos", newPos, pos, i, options.maxGroupDepth)
				if ((item as Expression.LogicNode).children) {
					return (
						<>
							<RelationGroup
								pos={newPos}
								changeRef={changeRef}
								conditionData={item as Expression.Condition}
								options={options}
								cacheDictionary={cacheDictionary}
								key={_.uniqueId("relation_group_")}
								readonly={readonly}
							/>
						</>
					)
				}
				return (
					<>
						<RelationItem
							pos={newPos}
							changeRef={changeRef}
							conditionData={item as Expression.CompareNode}
							options={options}
							cacheDictionary={cacheDictionary}
							key={_.uniqueId("relation_item_")}
							readonly={readonly}
						/>
					</>
				)
			})
		)
	}, [conditionData, pos, readonly, cacheDictionary, changeRef, options])

	return (
		<RelationGroupStyle isShowRelationSign={isShowRelationSign} operands={ops}>
			<div
				className="relation-group"
				style={{ display: isShowRelationSign ? "block" : "none" }}
			>
				<div className="relation-sign" onClick={switchOpsSign}>
					{ops === RELATION_LOGICS_MAP.AND
						? i18next.t("common.and", { ns: "magicFlow" })
						: i18next.t("common.or", { ns: "magicFlow" })}
				</div>
				<div className="add">
					<PlusCircleFilled className="icon" onClick={handleAddConditionItem} />
				</div>
			</div>
			<div
				className={classname("conditions", {
					"only-root": (conditionData as Expression.LogicNode).children.length === 1,
				})}
			>
				{memoGroupList}
			</div>
		</RelationGroupStyle>
	)
}
