// @ts-nocheck
import React, { useState } from "react"
import { Button, Card, Input, Select, Spin, Space, Typography, Tabs } from "antd"
import { IconArrowRight } from "@tabler/icons-react"
import {
	convertYAMLToJSON,
	convertJSONToYAML,
	convertJSONStringToYAML,
	convertYAMLToJSONString,
} from "../../utils/api/flowConverter"
import styles from "./index.module.less"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"

const { TextArea } = Input
const { Text, Title } = Typography
const { TabPane } = Tabs

/**
 * Flow转换器组件
 * 提供YAML和JSON之间互相转换的UI界面
 */
const FlowConverter: React.FC = () => {
	const { t } = useTranslation("flow")
	const [sourceText, setSourceText] = useState<string>("")
	const [resultText, setResultText] = useState<string>("")
	const [conversionType, setConversionType] = useState<string>("yaml2json")
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
		const fileType = conversionType.includes("yaml2json") ? "json" : "yml"
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
				case "yaml2json":
					result = convertYAMLToJSONString(sourceText)
					break
				case "json2yaml":
					result = convertJSONStringToYAML(sourceText)
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
			magicToast.error(t("converter.failedWithReason", { message: error.message }))
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
		<div className={styles.flowConverter}>
			<Tabs activeKey={activeTab} onChange={setActiveTab}>
				<TabPane tab={t("converter.tabTitle")} key="converter">
					<Card>
						<Title level={4}>{t("converter.flowTitle")}</Title>
						<Text>{t("converter.flowDesc")}</Text>

						<div className={styles.conversionTypeSelector}>
							<Select
								value={conversionType}
								onChange={setConversionType}
								options={[
									{ value: "yaml2json", label: t("converter.yamlToJson") },
									{ value: "json2yaml", label: t("converter.jsonToYaml") },
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
											conversionType === "yaml2json"
												? t("converter.yamlPlaceholder")
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
													conversionType === "yaml2json"
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
						<Title level={4}>{t("converter.helpTitle")}</Title>
						<Title level={5}>{t("converter.yamlToJsonHelpTitle")}</Title>
						<Text>
							{t("converter.yamlToJsonHelp")}
							<ul>
								<li>{t("converter.helpPasteYaml")}</li>
								<li>{t("converter.helpClickConvert")}</li>
								<li>{t("converter.helpDownloadOrCopy")}</li>
							</ul>
						</Text>

						<Title level={5}>{t("converter.jsonToYamlHelpTitle")}</Title>
						<Text>
							{t("converter.jsonToYamlHelp")}
							<ul>
								<li>{t("converter.helpPasteJson")}</li>
								<li>{t("converter.helpClickConvert")}</li>
								<li>{t("converter.helpDownloadOrCopy")}</li>
							</ul>
						</Text>

						<Title level={5}>{t("converter.yamlFormatTitle")}</Title>
						<Text>
							<pre
								style={{
									backgroundColor: "#f5f5f5",
									padding: "10px",
									borderRadius: "5px",
								}}
							>
								{`# Flow YAML格式示例
flow:
  name: "流程名称"
  description: "流程描述"
  version: "1.0.0"
  type: "workflow"

variables:
  - name: "变量名"
    type: "string"
    default: "默认值"

nodes:
  - id: "node-123"
    type: "start"
    name: "开始节点"
    position:
      x: 100
      y: 100
    params:
      # 节点参数...

edges:
  - id: "edge-123"
    source: "node-123"
    target: "node-456"
`}
							</pre>
						</Text>
					</Card>
				</TabPane>
			</Tabs>
		</div>
	)
}

export default FlowConverter
