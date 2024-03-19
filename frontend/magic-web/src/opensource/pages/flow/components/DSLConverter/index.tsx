import type React from "react"
import { useState } from "react"
import { Button, Card, Input, Select, Spin, Space, Typography, Tabs } from "antd"
import { IconArrowRight } from "@tabler/icons-react"
import { createStyles } from "antd-style"
import { convertDSLToJSONString, convertJSONStringToDSL } from "../../utils/api/dslConverter"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

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
			magicToast.warning("没有可下载的内容")
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
			magicToast.warning("请输入需要转换的内容")
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
				magicToast.success("转换成功")
			} else {
				magicToast.error("转换失败")
			}
		} catch (error) {
			console.error("转换错误:", error)
			magicToast.error(`转换失败: ${error instanceof Error ? error.message : String(error)}`)
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
				<TabPane tab="DSL转换器" key="converter">
					<Card>
						<Title level={4}>DSL和JSON格式互转</Title>
						<Text>将YAML工作流DSL格式和Flow JSON格式互相转换</Text>

						<div className={styles.conversionTypeSelector}>
							<Select
								value={conversionType}
								onChange={setConversionType}
								options={[
									{ value: "dsl2json", label: "DSL转JSON" },
									{ value: "json2dsl", label: "JSON转DSL" },
								]}
								style={{ width: 200 }}
							/>
						</div>

						<div className={styles.converterContainer}>
							<div className={styles.sourceContainer}>
								<Card title="源文件" bordered={false}>
									<TextArea
										value={sourceText}
										onChange={(e) => setSourceText(e.target.value)}
										placeholder={
											conversionType === "dsl2json"
												? "请输入YAML格式的DSL"
												: "请输入JSON格式的Flow"
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
												上传文件
											</Button>
											<Button onClick={handleClear}>清空</Button>
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
									转换
								</Button>
							</div>

							<div className={styles.resultContainer}>
								<Card title="转换结果" bordered={false}>
									<Spin spinning={loading}>
										<TextArea value={resultText} readOnly rows={20} />
									</Spin>
									<div className={styles.actions}>
										<Button
											type="primary"
											onClick={handleDownload}
											disabled={!resultText}
										>
											下载
										</Button>
									</div>
								</Card>
							</div>
						</div>
					</Card>
				</TabPane>

				<TabPane tab="帮助文档" key="help">
					<Card>
						<Title level={4}>DSL转换器使用说明</Title>
						<Title level={5}>DSL转JSON</Title>
						<Text>
							将YAML格式的工作流DSL(YAML格式)转换为Flow格式的JSON。
							<ul>
								<li>在源文件区域粘贴YAML格式的DSL内容，或者上传YAML文件</li>
								<li>点击&quot;转换&quot;按钮执行转换</li>
								<li>转换完成后，可以下载结果或复制结果</li>
							</ul>
						</Text>

						<Title level={5}>JSON转DSL</Title>
						<Text>
							将Flow格式的JSON转换为YAML格式的工作流DSL(YAML格式)。
							<ul>
								<li>在源文件区域粘贴JSON格式的Flow内容，或者上传JSON文件</li>
								<li>点击&quot;转换&quot;按钮执行转换</li>
								<li>转换完成后，可以下载结果或复制结果</li>
							</ul>
						</Text>

						<Title level={5}>注意事项</Title>
						<Text>
							<ul>
								<li>转换过程中可能会丢失一些特定于某种格式的信息</li>
								<li>不是所有的节点类型都能完美转换，可能需要手动调整</li>
								<li>如果转换失败，请检查源文件格式是否正确</li>
							</ul>
						</Text>
					</Card>
				</TabPane>
			</Tabs>
		</div>
	)
}

export default DSLConverter
