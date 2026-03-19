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
import magicToast from "@/components/base/MagicToaster/utils"

const { TextArea } = Input
const { Text, Title } = Typography
const { TabPane } = Tabs

/**
 * Flow转换器组件
 * 提供YAML和JSON之间互相转换的UI界面
 */
const FlowConverter: React.FC = () => {
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
			magicToast.warning("没有可下载的内容")
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
			magicToast.warning("请输入需要转换的内容")
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
				magicToast.success("转换成功")
			} else {
				magicToast.error("转换失败")
			}
		} catch (error) {
			console.error("转换错误:", error)
			magicToast.error(`转换失败: ${error.message}`)
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
				<TabPane tab="Flow转换器" key="converter">
					<Card>
						<Title level={4}>Flow YAML和JSON格式互转</Title>
						<Text>将Flow工作流YAML格式和JSON格式互相转换</Text>

						<div className={styles.conversionTypeSelector}>
							<Select
								value={conversionType}
								onChange={setConversionType}
								options={[
									{ value: "yaml2json", label: "YAML转JSON" },
									{ value: "json2yaml", label: "JSON转YAML" },
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
											conversionType === "yaml2json"
												? "请输入YAML格式的Flow"
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
						<Title level={4}>Flow转换器使用说明</Title>
						<Title level={5}>YAML转JSON</Title>
						<Text>
							将Flow格式的工作流YAML转换为JSON格式。
							<ul>
								<li>在源文件区域粘贴YAML格式的内容，或者上传YAML文件</li>
								<li>点击&quot;转换&quot;按钮执行转换</li>
								<li>转换完成后，可以下载结果或复制结果</li>
							</ul>
						</Text>

						<Title level={5}>JSON转YAML</Title>
						<Text>
							将Flow JSON格式转换为YAML格式。
							<ul>
								<li>在源文件区域粘贴JSON格式的内容，或者上传JSON文件</li>
								<li>点击&quot;转换&quot;按钮执行转换</li>
								<li>转换完成后，可以下载结果或复制结果</li>
							</ul>
						</Text>

						<Title level={5}>YAML格式说明</Title>
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
