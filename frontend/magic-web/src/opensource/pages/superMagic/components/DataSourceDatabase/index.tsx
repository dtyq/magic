import { useState, useCallback } from "react"
import { clipboard } from "@/opensource/utils/clipboard-helpers"
import { Form, Input, Button, Radio } from "antd"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconBrandMysql, IconCopy } from "@tabler/icons-react"
import { useStyles } from "./styles"
import { IconBrandPostgresql } from "@/opensource/enhance/tabler/icons-react"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface DatabaseConfig {
	name: string
	description: string
	type: "mysql" | "postgresql"
	host: string
	port: string
	database: string
	username: string
	password: string
}

export default function DataSourceDatabase() {
	const { styles, cx } = useStyles()
	const [form] = Form.useForm<DatabaseConfig>()
	const [loading, setLoading] = useState(false)
	const [testLoading, setTestLoading] = useState(false)
	const [selectedType, setSelectedType] = useState<"mysql" | "postgresql">("mysql")

	// 复制
	const copyIp = useCallback(() => {
		clipboard.writeText("127.0.0.1")
		magicToast.success("IP 已复制到剪贴板")
	}, [])

	// 处理数据库类型选择
	const handleTypeChange = useCallback(
		(type: "mysql" | "postgresql") => {
			setSelectedType(type)
			form.setFieldValue("type", type)

			// 根据数据库类型设置默认端口
			if (type === "mysql") {
				form.setFieldValue("port", "3306")
			} else if (type === "postgresql") {
				form.setFieldValue("port", "5432")
			}
		},
		[form],
	)

	// 测试连接
	const handleTestConnection = useCallback(async () => {
		try {
			setTestLoading(true)

			// 验证必填字段
			await form.validateFields(["host", "port", "database", "username", "password"])

			const values = form.getFieldsValue()

			// 这里应该调用实际的测试连接 API
			console.log("Testing connection with:", values)

			// 模拟 API 调用
			await new Promise((resolve) => setTimeout(resolve, 2000))

			magicToast.success("连接测试成功！")
		} catch (error: any) {
			if (error.errorFields) {
				magicToast.error("请填写完整的连接信息")
			} else {
				magicToast.error("连接测试失败，请检查配置信息")
			}
		} finally {
			setTestLoading(false)
		}
	}, [form])

	// 保存配置
	const handleSave = useCallback(async () => {
		try {
			setLoading(true)

			const values = await form.validateFields()

			// 这里应该调用实际的保存 API
			console.log("Saving database config:", values)

			// 模拟 API 调用
			await new Promise((resolve) => setTimeout(resolve, 1000))

			magicToast.success("数据源配置保存成功！")
		} catch (error) {
			magicToast.error("请填写完整的配置信息")
		} finally {
			setLoading(false)
		}
	}, [form])

	return (
		<Form
			className={styles.form}
			form={form}
			layout="vertical"
			initialValues={{
				type: "mysql",
				port: "3306",
			}}
		>
			{/* 基础信息 */}
			<div className={styles.section}>
				<div className={styles.sectionTitle}>基础信息</div>
				<Form.Item
					name="name"
					label="名称"
					rules={[{ required: true, message: "请输入数据源名称" }]}
				>
					<Input placeholder="请输入数据源名称" />
				</Form.Item>
				<Form.Item name="description" label="描述">
					<Input.TextArea
						placeholder="请输入数据源描述"
						rows={4}
						className={styles.textArea}
					/>
				</Form.Item>
			</div>

			{/* 数据库信息 */}
			<div className={styles.section}>
				<div className={styles.sectionTitle}>数据库信息</div>
				<Form.Item
					name="type"
					label="数据库类型"
					rules={[{ required: true, message: "请选择数据库类型" }]}
				>
					<Radio.Group
						className={styles.databaseTypeRadioGroup}
						value={selectedType}
						onChange={(e) => handleTypeChange(e.target.value)}
					>
						<Radio value="mysql">
							<div
								className={cx(
									styles.databaseTypeCard,
									selectedType === "mysql" && "selected",
								)}
							>
								<MagicIcon
									component={IconBrandMysql}
									size={18}
									className={styles.databaseIcon}
								/>
								<span className={styles.databaseName}>MySQL</span>
							</div>
						</Radio>
						<Radio value="postgresql">
							<div
								className={cx(
									styles.databaseTypeCard,
									selectedType === "postgresql" && "selected",
								)}
							>
								<MagicIcon
									component={IconBrandPostgresql}
									size={18}
									className={styles.postgresqlIcon}
									color="rgba(50, 96, 147, 1)"
								/>
								<span className={styles.databaseName}>PostgreSQL</span>
							</div>
						</Radio>
					</Radio.Group>
				</Form.Item>
				<Form.Item
					name="host"
					label="数据库地址"
					rules={[{ required: true, message: "请输入数据库地址" }]}
				>
					<Input placeholder="请输入数据库 Url 或 IP 地址" />
				</Form.Item>

				<Form.Item
					name="port"
					label="端口"
					rules={[{ required: true, message: "请输入端口" }]}
				>
					<Input placeholder="请输入端口" />
				</Form.Item>
				<Form.Item
					name="database"
					label="数据库名称"
					rules={[{ required: true, message: "请输入数据库名称" }]}
				>
					<Input placeholder="请输入数据库名称" />
				</Form.Item>
			</div>

			{/* 认证 */}
			<div className={styles.section}>
				<div className={styles.sectionTitle}>认证</div>

				<Form.Item
					name="username"
					label="数据库账号"
					rules={[{ required: true, message: "请输入数据库账号" }]}
				>
					<Input placeholder="请输入数据库账号" />
				</Form.Item>

				<Form.Item
					name="password"
					label="数据库密码"
					rules={[{ required: true, message: "请输入数据库密码" }]}
				>
					<Input.Password placeholder="请输入数据库密码" />
				</Form.Item>

				<div className={styles.ipTip}>
					<div className={styles.ipTipText}>
						确保以下 IP 在您数据库的 IP 白名单中：
						<span className={styles.ipAddress}>
							<span>127.0.0.1</span>
							<MagicIcon
								size={14}
								stroke={1.5}
								component={IconCopy}
								className={styles.ipCopyIcon}
								onClick={copyIp}
							/>
						</span>
					</div>
				</div>
			</div>

			{/* 操作按钮 */}
			<div className={styles.formActions}>
				<Button
					type="default"
					className={cx(styles.button, styles.testButton)}
					loading={testLoading}
					onClick={handleTestConnection}
				>
					测试连接
				</Button>

				<Button
					type="primary"
					className={styles.button}
					loading={loading}
					onClick={handleSave}
				>
					保存
				</Button>
			</div>
		</Form>
	)
}
