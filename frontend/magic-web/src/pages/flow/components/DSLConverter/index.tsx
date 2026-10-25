import type React from "react"
import { useState } from "react"
import { Button, Card, Input, Select, Spin, Space, Typography, Tabs } from "antd"
import { IconArrowRight } from "@tabler/icons-react"
import { createStyles } from "antd-style"
import { convertDSLToJSONString, convertJSONStringToDSL } from "../../utils/api/dslConverter"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"

const { TextArea } = Input
const { Text, Title } = Typography
const { TabPane } = Tabs

// 使用antd-style创建样式
const useStyles = createStyles(({ css }) => ({
	dslConverter: css`
		padding: 20px;
		max-width: 1200px;
		margin: 0 auto;
	`,
	conversionTypeSelector: css`
		margin: 20px 0;
	`,
	converterContainer: css`
		display: flex;
		flex-direction: row;
		gap: 16px;
		margin-top: 20px;

		@media (max-width: 768px) {
			flex-direction: column;
		}
	`,
	sourceContainer: css`
		flex: 1;
	`,
	resultContainer: css`
		flex: 1;
	`,
	convertButton: css`
		display: flex;
		align-items: center;
		padding: 0 8px;

		@media (max-width: 768px) {
			justify-content: center;
			padding: 16px 0;
		}
	`,
	actions: css`
		margin-top: 16px;
		display: flex;
		justify-content: flex-end;
	`,
}))

/**
 * DSL转换器组件
 * 提供DSL和JSON之间互相转换的UI界面
 */
const DSLConverter: React.FC = () => {
	const { t } = useTranslation("flow")
	const { styles } = useStyles()
	const [sourceText, setSourceText] = useState<string>("")
	const [resultText, setResultText] = useState<string>("")
	const [conversionType, setConversionType] = useState<string>("dsl2json")
	const [loading, setLoading] = useState<boolean>(false)
	const [activeTab, setActiveTab] = useState<string>("converter")

	// 文件上传处理
	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		const reader = new FileReader()
		reader.onload = (event) => {
			const content = event.target?.result as string
			setSourceText(content)
		}
		reader.readAsText(file)
	}

	// 下载结果
	const handleDownload = () => {
		if (!resultText) {
			magicToast.warning(t("converter.noDownloadableContent"))
			return
		}

		const element = document.createElement("a")
		const fileType = conversionType.includes("dsl2json") ? "json" : "yml"
		const file = new Blob([resultText], { type: "text/plain" })
		element.href = URL.createObjectURL(file)
		element.download = `converted.${fileType}`
		document.body.appendChild(element)
		element.click()
		document.body.removeChild(element)
	}

	// 执行转换
	const handleConvert = () => {
		if (!sourceText) {
			magicToast.warning(t("converter.pleaseEnterContent"))
			return
		}

		setLoading(true)
		try {
			let result

			switch (conversionType) {
				case "dsl2json":
					result = convertDSLToJSONString(sourceText)
					break
				case "json2dsl":
					result = convertJSONStringToDSL(sourceText)
					break
				default:
					result = null
			}

			if (result) {
				setResultText(result)
				magicToast.success(t("converter.success"))
			} else {
				magicToast.error(t("converter.failed"))
			}
		} catch (error) {
			console.error("转换错误:", error)
			magicToast.error(
				t("converter.failedWithReason", {
					message: error instanceof Error ? error.message : String(error),
				}),
			)
		} finally {
			setLoading(false)
		}
	}

	// 清空内容
	const handleClear = () => {
		setSourceText("")
		setResultText("")
	}

	return (
		<div className={styles.dslConverter}>
			<Tabs activeKey={activeTab} onChange={setActiveTab}>
				<TabPane tab={t("converter.dslTabTitle")} key="converter">
					<Card>
						<Title level={4}>{t("converter.dslTitle")}</Title>
						<Text>{t("converter.dslDesc")}</Text>

						<div className={styles.conversionTypeSelector}>
							<Select
								value={conversionType}
								onChange={setConversionType}
								options={[
									{ value: "dsl2json", label: t("converter.dslToJson") },
									{ value: "json2dsl", label: t("converter.jsonToDsl") },
								]}
								style={{ width: 200 }}
							/>
						</div>

						<div className={styles.converterContainer}>
							<div className={styles.sourceContainer}>
								<Card title={t("converter.sourceFile")} bordered={false}>
									<TextArea
										value={sourceText}
										onChange={(e) => setSourceText(e.target.value)}
										placeholder={
											conversionType === "dsl2json"
												? t("converter.dslPlaceholder")
												: t("converter.jsonPlaceholder")
										}
										rows={20}
									/>
									<div className={styles.actions}>
										<Space>
											<input
												type="file"
												id="file-upload"
												accept={
													conversionType === "dsl2json"
														? ".yml,.yaml"
														: ".json"
												}
												onChange={handleFileUpload}
												style={{ display: "none" }}
											/>
											<Button
												onClick={() =>
													document.getElementById("file-upload")?.click()
												}
											>
												{t("converter.uploadFile")}
											</Button>
											<Button onClick={handleClear}>
												{t("converter.clear")}
											</Button>
										</Space>
									</div>
								</Card>
							</div>

							<div className={styles.convertButton}>
								<Button
									type="primary"
									icon={<IconArrowRight />}
									onClick={handleConvert}
									loading={loading}
								>
									{t("converter.convert")}
								</Button>
							</div>

							<div className={styles.resultContainer}>
								<Card title={t("converter.result")} bordered={false}>
									<Spin spinning={loading}>
										<TextArea value={resultText} readOnly rows={20} />
									</Spin>
									<div className={styles.actions}>
										<Button
											type="primary"
											onClick={handleDownload}
											disabled={!resultText}
										>
											{t("converter.download")}
										</Button>
									</div>
								</Card>
							</div>
						</div>
					</Card>
				</TabPane>

				<TabPane tab={t("converter.helpTab")} key="help">
					<Card>
						<Title level={4}>{t("converter.dslHelpTitle")}</Title>
						<Title level={5}>{t("converter.dslToJsonHelpTitle")}</Title>
						<Text>
							{t("converter.dslToJsonHelp")}
							<ul>
								<li>{t("converter.helpPasteDsl")}</li>
								<li>{t("converter.helpClickConvert")}</li>
								<li>{t("converter.helpDownloadOrCopy")}</li>
							</ul>
						</Text>

						<Title level={5}>{t("converter.jsonToDslHelpTitle")}</Title>
						<Text>
							{t("converter.jsonToDslHelp")}
							<ul>
								<li>{t("converter.helpPasteJson")}</li>
								<li>{t("converter.helpClickConvert")}</li>
								<li>{t("converter.helpDownloadOrCopy")}</li>
							</ul>
						</Text>

						<Title level={5}>{t("converter.notesTitle")}</Title>
						<Text>
							<ul>
								<li>{t("converter.helpNote1")}</li>
								<li>{t("converter.helpNote2")}</li>
								<li>{t("converter.helpNote3")}</li>
							</ul>
						</Text>
					</Card>
				</TabPane>
			</Tabs>
		</div>
	)
}

export default DSLConverter
