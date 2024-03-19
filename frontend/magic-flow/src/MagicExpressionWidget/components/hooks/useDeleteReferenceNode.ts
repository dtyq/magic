/**
 * 特殊渲染组件：如单选、多选、成员等等，支持设置引用值时的公用方法状态
 */

import { EXPRESSION_ITEM, WithReference } from "@/MagicExpressionWidget/types"
import { useMemoizedFn } from "ahooks"

type UseDeleteReferenceNodeProps = {
    values: WithReference<any>[]
    setValues: React.Dispatch<React.SetStateAction<WithReference<any>[]>>
    config: EXPRESSION_ITEM
    updateFn: (val: EXPRESSION_ITEM) => void
    // 实际的赋值key
    valueName: string
}

export default function useDeleteReferenceNode({
    values,
    setValues,
    config,
    updateFn,
    valueName
}:UseDeleteReferenceNodeProps) {
  
    // 在特殊渲染块删除引用值的公用方法
	const onDeleteReferenceNode = useMemoizedFn((item: WithReference<EXPRESSION_ITEM>) => {
		const index = values.findIndex(
			(multipleItem) =>
				(multipleItem as EXPRESSION_ITEM)?.uniqueId === (item as EXPRESSION_ITEM)?.uniqueId,
		)
		if (index === -1) return
		values.splice(index, 1)
		setValues([...values])
		updateFn({
			...config,
			[valueName]: values,
		})
	})

    return {
        onDeleteReferenceNode
    }
}
