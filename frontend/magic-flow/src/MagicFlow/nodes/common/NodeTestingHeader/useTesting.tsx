import { useNodeTesting } from "@/MagicFlow/context/NodeTesingContext/useNodeTesting"
import { Spin } from "antd"
import { IconCircleCheckFilled, IconCircleXFilled } from "@tabler/icons-react"
import i18next from "i18next"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useCurrentNode } from "../context/CurrentNode/useCurrentNode"
import { generateDebugLogList, transformToList } from "./helpers"
import styles from "./index.module.less"

/** 日志面板的单行数据 */
export type TestingResultRow = {
	key: string
	value: string
}

export default function useTesting() {
	const { t } = useTranslation()
	const { testingNodeIds, testingResultMap, nowTestingNodeIds, position } = useNodeTesting()
	const { currentNode } = useCurrentNode()

	const currentNodeTestingResult = useMemo(() => {
		return testingResultMap?.[currentNode?.node_id!]
	}, [testingResultMap, currentNode])

	const isTesting = useMemo(() => {
		return nowTestingNodeIds.includes(currentNode?.node_id!)
	}, [nowTestingNodeIds, currentNode])

	const testingConfig = useMemo(() => {
		const currentNodeTestingResult = testingResultMap?.[currentNode?.node_id!]
		if (isTesting)
			return {
				icon: <Spin size="small" className={styles.headerLoading} />,
				label: `${i18next.t("flow.testing", { ns: "magicFlow" })}...`,
				background: "white",
				tags: [],
			}
		const result = {
			icon: <IconCircleCheckFilled size={24} color="#32C436" />,
			label: i18next.t("flow.testSuccess", { ns: "magicFlow" }),
			background: "#ECF9EC",
			tags: [
				{
					content: `${i18next.t("flow.testTime", { ns: "magicFlow" })} ${(
						Number(currentNodeTestingResult?.elapsed_time) / 1000
					).toFixed(2)}s`,
					background: "#D0F3CF",
					color: "#28A32D",
				},
			],
		}
		if (!currentNodeTestingResult?.success) {
			return {
				icon: <IconCircleXFilled size={24} color="#FF1809" />,
				label: i18next.t("flow.testError", { ns: "magicFlow" }),
				background: "#FFF0EB",
				tags: [],
			}
		}
		return result
	}, [testingResultMap, isTesting, nowTestingNodeIds])

	const inputList = useMemo(() => {
		return transformToList(currentNodeTestingResult!, "input")
	}, [currentNodeTestingResult?.input])

	const outputList = useMemo(() => {
		// 如果失败，则直接取error_message
		return transformToList(currentNodeTestingResult!, "output")
	}, [currentNodeTestingResult])

	const debugLogs = useMemo(() => {
		return generateDebugLogList(currentNodeTestingResult!)
	}, [currentNodeTestingResult])

	const isCurrentNodeTest = useMemo(() => {
		return testingNodeIds.includes(currentNode?.node_id!)
	}, [currentNode, testingNodeIds])

	/** 当前日志是否是数组类型 */
	const { isArrayTestResult, arrayTestResult } = useMemo(() => {
		const length = currentNodeTestingResult?.loop_debug_results?.length || 0
		return {
			isArrayTestResult: length > 0,
			arrayTestResult: currentNodeTestingResult?.loop_debug_results || [],
		}
	}, [currentNodeTestingResult])

	const isEmptyTest = useMemo(() => {
		return (
			outputList.length === 0 &&
			inputList.length === 0 &&
			!currentNodeTestingResult?.debug_log
		)
	}, [outputList, inputList])

	return {
		testingConfig,
		isCurrentNodeTest,
		inputList,
		outputList,
		isTesting,
		testingResult: currentNodeTestingResult,
		position,
		isArrayTestResult,
		arrayTestResult,
		isEmptyTest,
		debugLogs,
	}
}
