import { NodeTestConfig } from "@/MagicFlow/context/NodeTesingContext/Context"
import { IconCheck, IconCopy } from "@tabler/icons-react"
import clsx from "clsx"
import i18next from "i18next"
import React, { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import styles from "../../index.module.less"
import { TestingResultRow } from "../../useTesting"
import { formatValue, isComplexValue } from "../utils"
import { MiniMap } from "./MiniMap"

// 全屏模态窗口组件
export const FullscreenModal = ({
	visible,
	onClose,
	inputList,
	outputList,
	testingResult,
	debugLogs,
	allowDebug,
}: {
	visible: boolean
	onClose: () => void
	inputList: TestingResultRow[]
	outputList: TestingResultRow[]
	testingResult?: NodeTestConfig
	debugLogs?: TestingResultRow[]
	allowDebug: boolean
}) => {
	// 创建一个引用，用于小地图导航
	const contentRef = useRef<HTMLDivElement>(null)

	// 用于跟踪复制状态
	const [copyStates, setCopyStates] = useState({
		input: false,
		output: false,
		debug: false,
	})

	// 防止滚动穿透
	useEffect(() => {
		if (visible) {
			document.body.style.overflow = "hidden"
		} else {
			document.body.style.overflow = ""
		}
		return () => {
			document.body.style.overflow = ""
		}
	}, [visible])

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

	if (!visible) return null

	return createPortal(
		<div className={styles.fullscreenModalPortal}>
			<div className={styles.fullscreenModalContent}>
				<div className={styles.fullscreenModalHeader}>
					<h3>
						{i18next.t("flow.testDetail", {
							ns: "magicFlow",
							defaultValue: "测试详情",
						})}
					</h3>
					<button onClick={onClose}>×</button>
				</div>
				<div className={styles.fullscreenContentWrapper}>
					<div className={styles.fullscreenModalBody} ref={contentRef}>
						{/* 输入部分 */}
						<div className={styles.fullscreenSection}>
							<div className={styles.fullscreenSectionHeader}>
								<h4>{i18next.t("common.input", { ns: "magicFlow" })}</h4>
								<div className={styles.copyContainer}>
									<IconCopy
										className={styles.fullscreenCopyIcon}
										size={24}
										color="#1C1D2399"
										onClick={() => handleCopy(testingResult?.input, "input")}
										style={{ cursor: "pointer" }}
									/>
									{copyStates.input && (
										<IconCheck
											size={20}
											color="#52c41a"
											className={styles.checkIcon}
										/>
									)}
								</div>
							</div>
							<div className={styles.fullscreenSectionContent}>
								{inputList?.map?.((item, index) => {
									const isComplex = isComplexValue(item.value)
									const itemKey = `input-${item.key}-${index}`
									return (
										<div
											className={styles.fullscreenItem}
											key={index}
											data-item-key={itemKey}
										>
											<span className={styles.fullscreenKey}>{item.key}</span>
											<span className={styles.fullscreenSplitor}>:</span>
											<span
												className={clsx(styles.fullscreenValue, {
													[styles.fullscreenComplex]: isComplex,
												})}
											>
												{isComplex ? formatValue(item.value) : item.value}
											</span>
										</div>
									)
								})}
							</div>
						</div>

						{/* 输出部分 */}
						<div className={styles.fullscreenSection}>
							<div className={styles.fullscreenSectionHeader}>
								<h4>{i18next.t("common.output", { ns: "magicFlow" })}</h4>
								<div className={styles.copyContainer}>
									<IconCopy
										className={styles.fullscreenCopyIcon}
										size={24}
										color="#1C1D2399"
										onClick={() => handleCopy(testingResult?.output, "output")}
										style={{ cursor: "pointer" }}
									/>
									{copyStates.output && (
										<IconCheck
											size={20}
											color="#52c41a"
											className={styles.checkIcon}
										/>
									)}
								</div>
							</div>
							<div className={styles.fullscreenSectionContent}>
								{outputList?.map?.((item, index) => {
									const isComplex = isComplexValue(item.value)
									const itemKey = `output-${item.key}-${index}`
									return (
										<div
											className={styles.fullscreenItem}
											key={index}
											data-item-key={itemKey}
										>
											<span className={styles.fullscreenKey}>{item.key}</span>
											<span className={styles.fullscreenSplitor}>:</span>
											<span
												className={clsx(styles.fullscreenValue, {
													[styles.fullscreenError]:
														!testingResult?.success,
													[styles.fullscreenComplex]: isComplex,
												})}
											>
												{isComplex ? formatValue(item.value) : item.value}
											</span>
										</div>
									)
								})}
							</div>
						</div>

						{/* 调试日志部分 */}
						{allowDebug && debugLogs && debugLogs.length > 0 && (
							<div className={styles.fullscreenSection}>
								<div className={styles.fullscreenSectionHeader}>
									<h4>{i18next.t("flow.testDetail", { ns: "magicFlow" })}</h4>
									<div className={styles.copyContainer}>
										<IconCopy
											className={styles.fullscreenCopyIcon}
											size={18}
											color="#1C1D2399"
											onClick={() =>
												handleCopy(testingResult?.debug_log, "debug")
											}
											style={{ cursor: "pointer" }}
										/>
										{copyStates.debug && (
											<IconCheck
												size={18}
												color="#52c41a"
												className={styles.checkIcon}
											/>
										)}
									</div>
								</div>
								<div className={styles.fullscreenSectionContent}>
									{debugLogs?.map?.((item, index) => {
										const isComplex = isComplexValue(item.value)
										const itemKey = `debug-${item.key}-${index}`
										return (
											<div
												className={styles.fullscreenItem}
												key={index}
												data-item-key={itemKey}
											>
												<span className={styles.fullscreenKey}>
													{item.key}
												</span>
												<span className={styles.fullscreenSplitor}>:</span>
												<span
													className={clsx(styles.fullscreenValue, {
														[styles.fullscreenComplex]: isComplex,
													})}
												>
													{isComplex
														? formatValue(item.value)
														: item.value}
												</span>
											</div>
										)
									})}
								</div>
							</div>
						)}
					</div>

					{/* 添加小地图导航 */}
					<MiniMap
						contentRef={contentRef}
						inputList={inputList}
						outputList={outputList}
						debugLogs={debugLogs}
						allowDebug={allowDebug}
						testingResult={testingResult}
					/>
				</div>
			</div>
		</div>,
		document.body,
	)
}
