import { NodeTestConfig } from "@/MagicFlow/context/NodeTesingContext/Context"
import { Pagination } from "antd"
import { useMemoizedFn } from "ahooks"
import React, { useMemo, useState } from "react"
import OnceResult from "../OnceResult"
import { generateDebugLogList, transformToList } from "../helpers"
import { TestingResultRow } from "../useTesting"
import "./index.less"

type ArrayResultProps = {
	arrayTestResult?: NodeTestConfig[]
	onCopy: (value: TestingResultRow[]) => void
}

export default function ArrayResult({ arrayTestResult, onCopy }: ArrayResultProps) {
	const [currentPage, setCurrentPage] = useState(1)

	const onPageChange = useMemoizedFn((page: number) => {
		setCurrentPage(page)
	})

	const curPageTestingResult = useMemo(() => {
		return arrayTestResult?.[currentPage - 1]
	}, [arrayTestResult, currentPage])

	const outputList = useMemo(() => {
		// 如果失败，则直接取error_message
		return transformToList(curPageTestingResult!, "output")
	}, [curPageTestingResult])

	const inputList = useMemo(() => {
		return transformToList(curPageTestingResult!, "input")
	}, [curPageTestingResult])

	const debugLogs = useMemo(() => {
		return generateDebugLogList(curPageTestingResult!)
	}, [curPageTestingResult])

	return (
		<div className="nodeTestingArrayResult">
			<Pagination
				current={currentPage}
				total={arrayTestResult?.length}
				onChange={onPageChange}
				pageSize={1}
				className="test-pagination"
				showSizeChanger={false}
			/>
			<OnceResult
				inputList={inputList}
				outputList={outputList}
				testingResult={curPageTestingResult}
				debugLogs={debugLogs}
			/>
		</div>
	)
}
