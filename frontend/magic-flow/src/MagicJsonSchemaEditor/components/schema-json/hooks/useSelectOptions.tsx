/** 过滤出可用选项 */
import { FormItemType } from "@/MagicExpressionWidget/types"
import { SCHEMA_TYPE } from "@/MagicJsonSchemaEditor/constants"
import { cleanAndFilterArray, getSelectOptions } from "@/MagicJsonSchemaEditor/utils/helpers"
import { useContext, useMemo } from "react"
import { EditorContext } from "../../editor"

export default function useSelectOptions() {
	const context = useContext(EditorContext)
	const FILTER_OPTIONS = cleanAndFilterArray<FormItemType>((context.customOptions as any).normal)

	const NORMAL_OPTIONS = FILTER_OPTIONS.length > 0 ? FILTER_OPTIONS : SCHEMA_TYPE

	const selectOptions = useMemo(() => {
		return getSelectOptions(NORMAL_OPTIONS)
	}, [NORMAL_OPTIONS])

	return {
		selectOptions,
	}
}
