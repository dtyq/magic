import { NodeTestConfig } from "@/MagicFlow/context/NodeTesingContext/Context";
import { TestingResultRow } from "./useTesting";
import _ from "lodash";


/** 转化成列表 */
export const transformToList = (testConfig: NodeTestConfig, key = 'output' as keyof NodeTestConfig): TestingResultRow[] => {
    if(key === 'input' && !testConfig?.success) {
        return []
    }
	// 如果失败，则直接取error_message
	if (!testConfig?.success) {
		return [
			{
				key: "error_message",
				value: testConfig?.error_message || "",
			},
		]
	}
	return (
		Object.entries(testConfig?.[key] || {}).map(([key, value]) => {
			return {
				key,
				value: `${_.isObject(value) ? JSON.stringify(value) : value}`,
			}
		}) || []
	)
}

/** 生成debug列表 */
export const generateDebugLogList = (testConfig: NodeTestConfig): TestingResultRow[] => {
	return (
		Object.entries(testConfig?.debug_log || {}).map(([key, value]) => {
			return {
				key,
				value: `${_.isObject(value) ? JSON.stringify(value) : value}`,
			}
		}) || []
	)
}