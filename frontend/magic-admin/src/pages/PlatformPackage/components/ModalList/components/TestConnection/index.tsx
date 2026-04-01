import { Flex } from "antd"
import { forwardRef, memo, useImperativeHandle, useState } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { DangerLevel, MagicButton, WarningModal } from "components"
import { useOpenModal } from "@/hooks/useOpenModal"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useStyles } from "../../styles"
import { useApis } from "@/apis"
import { FailDetailModal } from "../FailDetailModal"
import type { AiManage } from "@/types/aiManage"
import { IconCircleCheckFilled, IconCircleXFilled } from "@tabler/icons-react"

export enum TestConnectionType {
	Model = "model",
	Power = "power",
}

export interface TestConnectionResultLike {
	status: boolean | number
	message: unknown
}

interface TestConnectionProps {
	data?: AiManage.ModelInfo
	isOfficialOrg?: boolean
	type?: TestConnectionType
	connectOk?: () => Promise<TestConnectionResultLike>
}

export interface TestConnectionRef {
	checkConnection: (model: AiManage.ModelInfo) => void
}

const TestConnection = forwardRef<TestConnectionRef, TestConnectionProps>(
	({ data, isOfficialOrg, type = "model", connectOk }, ref) => {
		const { t } = useTranslation("admin/ai/model")
		const { t: tCommon } = useTranslation("admin/common")
		const openModal = useOpenModal()
		const isMobile = useIsMobile()
		const { cx, styles } = useStyles()
		const { AIManageApi } = useApis()

		// 使用 useMap 管理每个模型的测试结果和 loading 状态
		const [testResult, setTestResult] = useState<TestConnectionResultLike | null>(null)
		const [loading, setLoading] = useState(false)

		/* 查看错误详情 */
		const checkErrorDetail = useMemoizedFn((res: { text: string; error?: string }) => {
			openModal(FailDetailModal, {
				currentResult: res,
			})
		})

		/* 测试连接 */
		const checkConnection = useMemoizedFn(async (model?: AiManage.ModelInfo) => {
			// 能力连通性：直接调回调，无需二次确认
			if (type === TestConnectionType.Power && connectOk) {
				try {
					setLoading(true)
					setTestResult(await connectOk())
				} catch (error) {
					console.error("测试连接失败", error)
				} finally {
					setLoading(false)
				}
				return
			}

			openModal(WarningModal, {
				open: true,
				title: t("testConnection"),
				content: t("testConnectionDesc", {
					unit:
						type === TestConnectionType.Model
							? "Token"
							: t("point", { ns: "admin/platform/manage" }),
				}),
				showDeleteText: false,
				dangerLevel: DangerLevel.Normal,
				okButtonProps: {
					danger: false,
				},
				okText: tCommon("button.confirm"),
				onOk: async () => {
					if (type !== TestConnectionType.Model || !model) return

					try {
						setLoading(true)
						const params = {
							service_provider_config_id: model.service_provider_config_id,
							model_version: model.model_version,
							model_id: model.id,
						}
						const result = isOfficialOrg
							? await AIManageApi.testConnection(params)
							: await AIManageApi.testConnectionNonOfficial(params)
						setTestResult(result)
					} catch (error) {
						console.error("测试连接失败", error)
					} finally {
						setLoading(false)
					}
				},
			})
		})

		useImperativeHandle(
			ref,
			() => ({
				checkConnection,
			}),
			[checkConnection],
		)

		/* 获取测试状态 */
		const getTestStatus = useMemoizedFn(() => {
			const result = testResult

			if (!result) return null

			if (result.status)
				return {
					text: t("testStatusNormal"),
				}
			return { text: t("testStatusError"), error: JSON.stringify(result.message) }
		})

		/** 获取测试状态渲染 */
		const getTestStatusRender = useMemoizedFn(() => {
			const result = getTestStatus()
			const isError = !!result?.error

			if (!result?.text) return null

			return (
				<Flex
					gap={4}
					className={cx(styles.testStatus, isError && styles.error)}
					align="center"
				>
					{isError ? (
						<IconCircleXFilled
							color="currentColor"
							size={20}
							onClick={() => {
								if (isMobile) {
									checkErrorDetail(result)
								}
							}}
						/>
					) : (
						<IconCircleCheckFilled color="currentColor" size={20} />
					)}

					{!isMobile && (
						<>
							<div>{t("testStatus", { status: result.text })}</div>
							{isError && (
								<div
									className={styles.checkDetail}
									onClick={() => checkErrorDetail(result)}
								>
									{t("checkDetail")}
								</div>
							)}
						</>
					)}
				</Flex>
			)
		})

		return (
			<Flex gap={isMobile ? 6 : 10} align="center" style={{ flexShrink: 0 }}>
				{getTestStatusRender()}
				<MagicButton
					size={isMobile ? "small" : "middle"}
					loading={loading}
					onClick={() => checkConnection(data)}
				>
					{t("testConnection")}
				</MagicButton>
			</Flex>
		)
	},
)

TestConnection.displayName = "TestConnection"

export default memo(TestConnection)
