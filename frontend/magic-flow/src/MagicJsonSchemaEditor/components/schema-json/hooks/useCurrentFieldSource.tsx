/**
 * 当前字段的数据源状态管理
 */
import i18next from "i18next"
import _ from "lodash"
import { useContext, useMemo } from "react"
import { useGlobal } from "../../../context/GlobalContext/useGlobal"
import { EditorContext } from "../../editor"

export type CurrentFieldSource = {
	curFieldKeys: string[]
}

export default function useCurrentFieldSource({ curFieldKeys }: CurrentFieldSource) {
	const {
		innerExpressionSourceMap,
		allowSourceInjectBySelf,
		contextExpressionSource,
		uniqueFormId,
	} = useGlobal()
	const context = useContext(EditorContext)

	const { allowExpression, expressionSource } = context

	const currentFieldExpressionSource = useMemo(() => {
		if (!expressionSource || !allowExpression) return []
		const result = [
			// 如果存在上文数据源
			...(contextExpressionSource || []),
			...expressionSource,
		]
		if (!allowSourceInjectBySelf) return result
		const currentFieldInnerSource = _.get(innerExpressionSourceMap, curFieldKeys.join("."), [])
		// console.log(curFieldKeys.join('.'), innerExpressionSourceMap);
		if (currentFieldInnerSource.length === 0) return result
		// result.unshift({
		// 	label: i18next.t("jsonSchema.currentForm", { ns: "magicFlow" }),
		// 	value: `fields_${uniqueFormId}`,
		// 	desc: "",
		// 	children: currentFieldInnerSource as any,
		// })

		return result
	}, [expressionSource, innerExpressionSourceMap])

	return {
		currentFieldExpressionSource,
	}
}
