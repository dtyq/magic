// @ts-ignore
import Snowflake from "snowflake-id"
import { TextAreaModeTrigger } from "./constant"
import { DataSourceOption } from "@/common/BaseUI/DropdownRenderer/Reference"
import { Splitor } from "@/common/BaseUI/DropdownRenderer/Reference/constants"
import { getReferencePrefix } from "@/MagicFlow/utils"
import { CursorRef, EXPRESSION_VALUE, InputExpressionValue, LabelTypeMap, MethodOption } from "./types"
import _ from "lodash"

const snowflake = new Snowflake({
	mid: 1024,
	offset: (2020 - 1970) * 31536000 * 1000,
})

/**
 * @description 生成唯一标识
 * @returns {string} 唯一标识
 */
export const SnowflakeId = () => {
	return snowflake.generate()
}

/** 查找根节点 */
export const findRootNodeByValue = (treeData: Record<string, any>[], targetValue: string) => {
	// 遍历 treeData 数据
	for (let i = 0; i < treeData.length; i += 1) {
		const currentNode = treeData[i]

		// 如果当前节点的值匹配目标值，则返回当前节点
		if (currentNode.value === targetValue) {
			return currentNode
		}

		// 如果当前节点有子节点，递归查找子节点
		if (currentNode.children) {
			const result = findRootNodeByValue(currentNode.children, targetValue)
			if (result) {
				return currentNode // 如果子节点中找到目标值，返回当前节点
			}
		}
	}

	// 如果未找到目标值，返回 null
	return null
}

/** 查找目标元素的root和本身 */
export const findRootNodeAndValueByValue = (
	treeData: Record<string, any>[],
	targetValue: string,
) => {
	const findNode = (
		data: Record<string, any>[],
		target: string,
		parent: Record<string, any> | null,
	): { root: Record<string, any>; value: Record<string, any> } | null => {
		for (let i = 0; i < data.length; i += 1) {
			const currentNode = data[i]
			if (currentNode.value === target) {
				return {
					root: parent || currentNode,
					value: currentNode,
				}
			}
			if (currentNode.children) {
				const result = findNode(currentNode.children, target, currentNode)
				if (result) {
					return result
				}
			}
		}
		return null
	}

	return findNode(treeData, targetValue, null)
}

/** 获取 aaa.bbb.ccc 的ccc */
export const getLastName = (str: string) => {
	const paths = str.split(".")
	if (paths.length === 0) return str
	return paths[paths.length - 1]
}



export const checkIsAllDollarWrapped = (str: string) => {
    let pass = false

    const isCharCheck = (checkStr: string, index: number) => {
        const beforeChar = checkStr[index-1]
        const nextChar = checkStr[index+1]
        const isBeforeCharChecked = beforeChar === "'" || beforeChar === '"' || beforeChar === TextAreaModeTrigger
        const isNextCharChecked = nextChar === "'" || nextChar === '"' || nextChar === TextAreaModeTrigger
        return isBeforeCharChecked && isNextCharChecked
    }
    
    for(let i = 0; i < str.length; i++) {
        const char = str[i]
        if(char === TextAreaModeTrigger) {
            if(i === 0 || i === str.length - 1) return true
            if(!isCharCheck(str, i)) return true
        }
    }

    return pass
}

// 设置所有节点的 key 到 expandedKeys 中
export const getDataSourceMap = (data: DataSourceOption[]) => {
    let map = {} as Record<string, DataSourceOption>
    data.forEach((item) => {
		const prefix = getReferencePrefix(item)
		if(prefix) {
            // 处理选择了节点的情况
            if(prefix === item.key) {
                map[prefix] = item
            }else{
                map[`${prefix}${Splitor}${item.key}`] = item;

            }
		}else {
			map[`${item.key}`] = item;
		}
        if (item.children) {

            map = {
                ...map,
                ...getDataSourceMap(item.children)
            }
        }
    });
    return map;
};

/** 获取第一个表达式项，通常用于获取「表达式单选控件」的内部实际值 */
export const getExpressionFirstItem = (value: InputExpressionValue) => {
	return value?.expression_value?.[0]
}

export const transformDataSource = (dataSource: MethodOption[]): DataSourceOption[] => {
	return dataSource.map(item => {
		return {
			title: item.label,
			key: item.value,
			nodeId: "",
			nodeType: "",
			children: item.children ? transformDataSource(item.children) : [] as DataSourceOption[],
			arg: item.arg,
			type: undefined,
			isRoot: false,
			isConstant: false,
			rawSchema: undefined,
			renderType: undefined,
			isGlobal: false,
			desc: item.desc,
			isMethod: (item.children || []).length > 0 ? false : true,
            return_type: item.return_type,
            selectable: (item.children || []).length > 0 ? false : true
		}
	}) as DataSourceOption[]
}

const findAllIndices = (str: string, char: string): number[] => {
    str = str.trim()
    const regex = new RegExp(char, 'g');
    const indices: number[] = [];
    let match;
    while ((match = regex.exec(str)) !== null) {
        indices.push(match.index);
    }
    return indices;
};

//查找实际进行@的表达式块，返回具体的offset和uniqueId
export const findTargetTriggerField = (expressionField: EXPRESSION_VALUE[], cursor: CursorRef) => {
    const { offset, id } = cursor
    // 找到所有带有Trigger的表达式块
    const allHasTriggerFields = _.cloneDeep(expressionField.filter((field) =>
        field.value.includes(TextAreaModeTrigger),
    ))

    // 对以上的字符串都进行换行替换，避免offset计算错误
    const replacedFields = allHasTriggerFields.map(field => ({
        ...field,
        value: field.value.replace(/\n/g, '$')
    }))


    // 所有Trigger的位置
    const allTriggerIndices = replacedFields.reduce((result, field) => {
        // console.log("field.value",field.value,field.value.length)
        const indicesArr = findAllIndices(field.value, TextAreaModeTrigger)
        // console.log("indicesArr",indicesArr)
        const indicesFields = indicesArr.map((indices) => ({
            uniqueId: field.uniqueId,
            offset: indices,
        }))
        result.push(...indicesFields)
        return result
    }, [] as Array<{
        offset: number;
        uniqueId: string;
    }>)

    // console.log("allTriggerIndices",allTriggerIndices,allHasTriggerFields,offset,id)

    // 只要有一个Trigger的位置在当前光标之前，则显示出来
    // TODO: 需要排查下为什么有时候光标的位置是Trigger+2
    const targetTriggerField = allTriggerIndices?.find?.(indicesObject => {
        const isSameOffset = indicesObject.offset === offset - 1 || indicesObject.offset === offset - 2
        const isSameField = indicesObject.uniqueId === id
        return isSameOffset && isSameField
    })
    
    return targetTriggerField
}

// 判断输入值是否是引用值
export const checkIsReferenceNode = (input: any) => {
    return input?.type === LabelTypeMap.LabelFunc || input?.type === LabelTypeMap.LabelNode
}