import { copyToClipboard } from "@/MagicFlow/utils"
import { message } from "antd"
import { IconX } from "@tabler/icons-react"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import clsx from "clsx"
import i18next from "i18next"
import React, { useCallback, useRef, useState, memo, FC } from "react"
import { useTranslation } from "react-i18next"
import { useCurrentNode } from "../context/CurrentNode/useCurrentNode"
import ArrayResult from "./ArrayResult"
import OnceResult from "./OnceResult"
import styles from "./index.module.less"
import useTesting, { TestingResultRow } from "./useTesting"
import useNodeSelected from "@/MagicFlow/hooks/useNodeSelected"

// 定义Tag类型
interface Tag {
	content: string
	background: string
	color: string
}

// 定义TestingTags组件的Props接口
interface TestingTagsProps {
	tags?: Tag[]
}

// 提取子组件，减少主组件重绘
const TestingTags: FC<TestingTagsProps> = memo(({ tags }) => {
	return (
		<div className={styles.tags}>
			{tags?.map((tag, index) => (
				<span
					className={styles.tag}
					style={{ background: tag.background, color: tag.color }}
					key={index}
				>
					{tag.content}
				</span>
			))}
		</div>
	)
})

// 定义ToggleButton组件的Props接口
interface ToggleButtonProps {
	showBody: boolean
	isTesting: boolean
	isEmptyTest: boolean
	onToggle: () => void
}

// 提取切换按钮组件
const ToggleButton: FC<ToggleButtonProps> = memo(
	({ showBody, isTesting, isEmptyTest, onToggle }) => {
		if (isTesting || isEmptyTest) return null

		return (
			<span className={styles.open} onClick={onToggle}>
				{showBody
					? i18next.t("flow.foldTestResult", { ns: "magicFlow" })
					: i18next.t("flow.expandTestResult", { ns: "magicFlow" })}
			</span>
		)
	},
)

const NodeTestingHeaderComponent: FC = () => {
	const { t } = useTranslation()
	const {
		testingConfig,
		isCurrentNodeTest,
		inputList,
		outputList,
		isTesting,
		testingResult,
		isArrayTestResult,
		arrayTestResult,
		isEmptyTest,
		debugLogs,
	} = useTesting()

	const [showBody, setShowBody] = useState(true)
	const bodyRef = useRef<HTMLDivElement | null>(null)
	const { currentNode } = useCurrentNode()
	const { isSelected } = useNodeSelected(currentNode?.node_id)

	const onCopy = useMemoizedFn((target: TestingResultRow[]) => {
		copyToClipboard(JSON.stringify(target))
		message.success(i18next.t("common.copySuccess", { ns: "magicFlow" }))
	})

	const handleToggleBody = useCallback(() => {
		setShowBody((prev) => !prev)
	}, [])

	const handleCloseBody = useCallback(() => {
		setShowBody(false)
	}, [])

	useUpdateEffect(() => {
		setShowBody(true)
	}, [testingResult?.success])

	if (!isCurrentNodeTest) return null

	return (
		<div className={styles.nodeTestResult}>
			<div className={styles.nodeTestingHeader}>
				<div className={styles.left}>
					<span
						className={clsx(styles.icon, {
							[styles.loadingIcon]: isTesting,
						})}
					>
						{testingConfig?.icon}
					</span>
					<span className={styles.label}>{testingConfig?.label}</span>
					<TestingTags tags={testingConfig?.tags} />
				</div>
				<div className={styles.right}>
					<ToggleButton
						showBody={showBody}
						isTesting={isTesting}
						isEmptyTest={isEmptyTest}
						onToggle={handleToggleBody}
					/>
				</div>
			</div>
			{showBody && !isEmptyTest && (
				<div
					className={clsx(styles.nodeTestingContent, {
						nowheel: isSelected,
					})}
					ref={bodyRef}
				>
					<IconX
						stroke={2}
						width={20}
						className={styles.iconX}
						onClick={handleCloseBody}
					/>
					{!isArrayTestResult && (
						<OnceResult
							inputList={inputList}
							outputList={outputList}
							testingResult={testingResult}
							debugLogs={debugLogs}
						/>
					)}
					{isArrayTestResult && (
						<ArrayResult arrayTestResult={arrayTestResult} onCopy={onCopy} />
					)}
				</div>
			)}
		</div>
	)
}

// 使用memo包装整个组件
const NodeTestingHeader = memo(NodeTestingHeaderComponent)

export default NodeTestingHeader
