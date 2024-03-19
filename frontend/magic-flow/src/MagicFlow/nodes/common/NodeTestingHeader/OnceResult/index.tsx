import { useExternalConfig } from "@/MagicFlow/context/ExternalContext/useExternal"
import { NodeTestConfig } from "@/MagicFlow/context/NodeTesingContext/Context"
import { IconCheck, IconCopy, IconMaximize } from "@tabler/icons-react"
import clsx from "clsx"
import i18next from "i18next"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import styles from "../index.module.less"
import { TestingResultRow } from "../useTesting"
import { FullscreenModal } from "./components/FullscreenModal"
import { formatValue, isComplexValue } from "./utils"

type OnceResultProps = {
	inputList: TestingResultRow[]
	outputList: TestingResultRow[]
	testingResult?: NodeTestConfig
	debugLogs?: TestingResultRow[]
}

export default function OnceResult({
	inputList,
	outputList,
	testingResult,
	debugLogs,
}: OnceResultProps) {
	const { t } = useTranslation()
	const { allowDebug } = useExternalConfig()

	// 添加全屏模态窗口状态
	const [fullscreenModalVisible, setFullscreenModalVisible] = React.useState(false)

	// 用于跟踪复制状态
	const [copyStates, setCopyStates] = useState({
		input: false,
		output: false,
		debug: false,
	})

	// 打开全屏模态窗口的函数
	const openFullscreenModal = () => {
		setFullscreenModalVisible(true)
	}

	// 关闭全屏模态窗口
	const closeFullscreenModal = () => {
		setFullscreenModalVisible(false)
	}

	// 复制功能
	const handleCopy = (value: any, key: "input" | "output" | "debug") => {
		if (value) {
			const textToCopy =
				typeof value === "object" ? JSON.stringify(value, null, 2) : value.toString()
			navigator.clipboard.writeText(textToCopy)

			// 设置对应的复制状态为成功
			setCopyStates((prev) => ({
				...prev,
				[key]: true,
			}))

			// 2秒后恢复状态
			setTimeout(() => {
				setCopyStates((prev) => ({
					...prev,
					[key]: false,
				}))
			}, 2000)
		}
	}

	return (
		<>
			<div className={styles.input}>
				<div className={styles.header}>
					<span className={styles.inputTitle}>
						{i18next.t("common.input", { ns: "magicFlow" })}
					</span>
					<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
						<div className={styles.copyContainer}>
							<IconCopy
								color="#1C1D2399"
								size={12}
								onClick={() => handleCopy(testingResult?.input!, "input")}
								style={{ cursor: "pointer" }}
							/>
							{copyStates.input && (
								<IconCheck size={12} color="#52c41a" className={styles.checkIcon} />
							)}
						</div>
						{/* 全屏查看按钮放在复制按钮旁边 */}
						<button
							className={styles.fullscreenButton}
							onClick={openFullscreenModal}
							style={{
								padding: "2px 6px",
								height: "22px",
								fontSize: "12px",
								display: "flex",
								alignItems: "center",
								gap: "4px",
							}}
						>
							<IconMaximize size={12} />
							{i18next.t("flow.fullscreen", {
								ns: "magicFlow",
								defaultValue: "全屏查看",
							})}
						</button>
					</div>
				</div>
				<div className={clsx(styles.body, "nodrag")}>
					{inputList?.map?.((item, index) => {
						const isComplex = isComplexValue(item.value)
						return (
							<div className={styles.bodyItem} key={index}>
								<span className={styles.key}>{item.key}</span>
								<span className={styles.splitor}>:</span>
								<span
									className={clsx(styles.value, {
										[styles.complexValue]: isComplex,
									})}
								>
									{isComplex ? formatValue(item.value) : item.value}
								</span>
							</div>
						)
					})}
				</div>
			</div>
			<div className={clsx(styles.output, "nodrag")}>
				<div className={styles.header}>
					<span className={styles.inputTitle}>
						{i18next.t("common.output", { ns: "magicFlow" })}
					</span>
					<div className={styles.copyContainer}>
						<IconCopy
							color="#1C1D2399"
							size={16}
							onClick={() => handleCopy(testingResult?.output!, "output")}
							style={{ cursor: "pointer" }}
						/>
						{copyStates.output && (
							<IconCheck size={16} color="#52c41a" className={styles.checkIcon} />
						)}
					</div>
				</div>
				<div className={styles.body}>
					{outputList?.map?.((item, index) => {
						const isComplex = isComplexValue(item.value)
						return (
							<div className={styles.bodyItem} key={index}>
								<span className={styles.key}>{item.key}</span>
								<span className={styles.splitor}>:</span>
								<span
									className={clsx(styles.value, {
										[styles.error]: !testingResult?.success,
										[styles.complexValue]: isComplex,
									})}
								>
									{isComplex ? formatValue(item.value) : item.value}
								</span>
							</div>
						)
					})}
				</div>
			</div>
			{allowDebug && (
				<div className={styles.output}>
					<div className={styles.header}>
						<span className={styles.inputTitle}>
							{i18next.t("flow.testDetail", { ns: "magicFlow" })}
						</span>
						<div className={styles.copyContainer}>
							<IconCopy
								color="#1C1D2399"
								size={16}
								onClick={() => handleCopy(testingResult?.debug_log!, "debug")}
								style={{ cursor: "pointer" }}
							/>
							{copyStates.debug && (
								<IconCheck size={16} color="#52c41a" className={styles.checkIcon} />
							)}
						</div>
					</div>
					<div className={styles.body}>
						{debugLogs?.map?.((item, index) => {
							const isComplex = isComplexValue(item.value)
							return (
								<div className={styles.bodyItem} key={index}>
									<span className={styles.key}>{item.key}</span>
									<span className={styles.splitor}>:</span>
									<span
										className={clsx(styles.value, {
											[styles.complexValue]: isComplex,
										})}
									>
										{isComplex ? formatValue(item.value) : item.value}
									</span>
								</div>
							)
						})}
					</div>
				</div>
			)}

			{/* 使用新的Portal版本的全屏模态窗口 */}
			<FullscreenModal
				visible={fullscreenModalVisible}
				onClose={closeFullscreenModal}
				inputList={inputList}
				outputList={outputList}
				testingResult={testingResult}
				debugLogs={debugLogs}
				allowDebug={allowDebug}
			/>
		</>
	)
}
