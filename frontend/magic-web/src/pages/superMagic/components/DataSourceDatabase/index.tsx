import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { clipboard } from "@/utils/clipboard-helpers"
import { Form, Input, Button, Radio } from "antd"
import MagicIcon from "@/components/base/MagicIcon"
import { IconBrandMysql, IconCopy } from "@tabler/icons-react"
import { useStyles } from "./styles"
import { IconBrandPostgresql } from "@/enhance/tabler/icons-react"
import magicToast from "@/components/base/MagicToaster/utils"

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
	const { t } = useTranslation("super")
	const { styles, cx } = useStyles()
	const [form] = Form.useForm<DatabaseConfig>()
	const [loading, setLoading] = useState(false)
	const [testLoading, setTestLoading] = useState(false)
	const [selectedType, setSelectedType] = useState<"mysql" | "postgresql">("mysql")

	// 复制
	const copyIp = useCallback(() => {
		clipboard.writeText("127.0.0.1")
		magicToast.success(t("dataSource.ipCopied"))
	}, [t])

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

			magicToast.success(t("dataSource.testSuccess"))
		} catch (error: any) {
			if (error.errorFields) {
				magicToast.error(t("dataSource.fillConnectionInfo"))
			} else {
				magicToast.error(t("dataSource.testFailed"))
			}
		} finally {
			setTestLoading(false)
		}
	}, [form, t])

	// 保存配置
	const handleSave = useCallback(async () => {
		try {
			setLoading(true)

			const values = await form.validateFields()

			// 这里应该调用实际的保存 API
			console.log("Saving database config:", values)

			// 模拟 API 调用
			await new Promise((resolve) => setTimeout(resolve, 1000))

			magicToast.success(t("dataSource.saveSuccess"))
		} catch (error) {
			magicToast.error(t("dataSource.fillConfig"))
		} finally {
			setLoading(false)
		}
	}, [form, t])

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
				<div className={styles.sectionTitle}>{t("dataSource.basicInfo")}</div>
				<Form.Item
					name="name"
					label={t("dataSource.name")}
					rules={[{ required: true, message: t("dataSource.nameRequired") }]}
				>
					<Input placeholder={t("dataSource.namePlaceholder")} />
				</Form.Item>
				<Form.Item name="description" label={t("dataSource.description")}>
					<Input.TextArea
						placeholder={t("dataSource.descriptionPlaceholder")}
						rows={4}
						className={styles.textArea}
					/>
				</Form.Item>
			</div>

			{/* 数据库信息 */}
			<div className={styles.section}>
				<div className={styles.sectionTitle}>{t("dataSource.dbInfo")}</div>
				<Form.Item
					name="type"
					label={t("dataSource.dbType")}
					rules={[{ required: true, message: t("dataSource.dbTypeRequired") }]}
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
					label={t("dataSource.host")}
					rules={[{ required: true, message: t("dataSource.hostRequired") }]}
				>
					<Input placeholder={t("dataSource.hostPlaceholder")} />
				</Form.Item>

				<Form.Item
					name="port"
					label={t("dataSource.port")}
					rules={[{ required: true, message: t("dataSource.portRequired") }]}
				>
					<Input placeholder={t("dataSource.portPlaceholder")} />
				</Form.Item>
				<Form.Item
					name="database"
					label={t("dataSource.database")}
					rules={[{ required: true, message: t("dataSource.databaseRequired") }]}
				>
					<Input placeholder={t("dataSource.databasePlaceholder")} />
				</Form.Item>
			</div>

			{/* 认证 */}
			<div className={styles.section}>
				<div className={styles.sectionTitle}>{t("dataSource.auth")}</div>

				<Form.Item
					name="username"
					label={t("dataSource.username")}
					rules={[{ required: true, message: t("dataSource.usernameRequired") }]}
				>
					<Input placeholder={t("dataSource.usernamePlaceholder")} />
				</Form.Item>

				<Form.Item
					name="password"
					label={t("dataSource.password")}
					rules={[{ required: true, message: t("dataSource.passwordRequired") }]}
				>
					<Input.Password placeholder={t("dataSource.passwordPlaceholder")} />
				</Form.Item>

				<div className={styles.ipTip}>
					<div className={styles.ipTipText}>
						{t("dataSource.ipWhitelistTip")}
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
					{t("dataSource.testConnection")}
				</Button>

				<Button
					type="primary"
					className={styles.button}
					loading={loading}
					onClick={handleSave}
				>
					{t("dataSource.save")}
				</Button>
			</div>
		</Form>
	)
}
