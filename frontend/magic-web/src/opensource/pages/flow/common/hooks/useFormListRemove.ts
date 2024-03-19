import { get, set } from "lodash-es"
import type { FormInstance } from "antd"
import { useNodeConfigActions } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useMemoizedFn } from "ahooks"

/**
 * 用于处理 Form.List 删除项的 hook
 * 绕过 Form.List 的 remove 方法，直接操作数组并更新表单值
 */
export default function useFormListRemove() {
	const { currentNode } = useCurrentNode()
	const { updateNodeConfig } = useNodeConfigActions()

	/**
	 * 删除 Form.List 中的项
	 * @param form Form 实例
	 * @param fieldName 字段名数组，如 ['filters'] 或 ['knowledge_config', 'knowledge_list']
	 * @param index 要删除的索引
	 */
	const removeFormListItem = useMemoizedFn(
		(form: FormInstance, fieldName: string[], index: number) => {
			// 先获取当前字段的值（数组）
			const currentList = [...(get(form.getFieldsValue(), fieldName) || [])]

			// 移除指定索引的项
			currentList.splice(index, 1)

			// 创建要设置的表单值对象
			const fieldValueObj: any = {}
			set(fieldValueObj, fieldName, currentList)

			// 更新表单值
			form.setFieldsValue(fieldValueObj)

			// 如果有当前节点，则更新节点配置
			if (currentNode) {
				// 构建路径数组，添加 params 前缀
				const paramsPath = ["params", ...fieldName]

				// 更新当前节点的参数
				set(currentNode, paramsPath, currentList)

				// 更新节点配置
				updateNodeConfig({ ...currentNode })
			}
		},
	)

	return {
		removeFormListItem,
	}
}
