/**
 * 判断字符串是否可能是JSON
 * @param str 要检查的字符串
 * @returns 是否可能是JSON格式
 */
export const isJsonString = (str: string): boolean => {
    if (typeof str !== "string") return false
    str = str.trim()
    return (
        (str.startsWith("{") && str.endsWith("}")) || (str.startsWith("[") && str.endsWith("]"))
    )
}

/**
 * 格式化可能是JSON字符串的值
 * @param value 可能是JSON的字符串
 * @returns 格式化后的JSON字符串
 */
export const formatValue = (value: string): string => {
    if (!isJsonString(value)) return value

    try {
        // 尝试解析JSON
        const parsed = JSON.parse(value)
        // 重新格式化为美观的JSON字符串
        return JSON.stringify(parsed, null, 2)
    } catch (e) {
        // 如果解析失败，返回原始值
        return value
    }
}

/**
 * 判断是否为复杂的JSON字符串（对象或数组）
 * @param value 要检查的字符串
 * @returns 是否为复杂JSON结构
 */
export const isComplexValue = (value: string): boolean => {
    return isJsonString(value) && value.length > 20
} 