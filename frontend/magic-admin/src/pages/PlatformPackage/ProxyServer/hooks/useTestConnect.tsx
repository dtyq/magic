import { useRequest, useMemoizedFn } from "ahooks"
import { useApis } from "@/apis"
import type { PlatformPackage } from "@/types/platformPackage"
import { useOpenModal } from "@/hooks/useOpenModal"
import { useTranslation } from "react-i18next"
import { Flex } from "antd"
import { MagicButton } from "components"
import { IconCircleCheckFilled, IconCircleXFilled } from "@tabler/icons-react"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useStyles } from "../components/AddProxyServerModal/styles"
import { FailDetailModal } from "../../components/ModalList/components/FailDetailModal"

interface UseTestConnectProps {
	info?: PlatformPackage.ProxyServer | null
	justify?: "space-between" | "flex-end"
}

const connectionResultMap = new Map<string, PlatformPackage.TestProxyConnection>()

export const useTestConnect = ({ info, justify }: UseTestConnectProps) => {
	const { t } = useTranslation("admin/platform/proxy")
	const { styles, cx } = useStyles()
	const isMobile = useIsMobile()
	const openModal = useOpenModal()

	const { PlatformPackageApi } = useApis()

	const { run, loading } = useRequest(PlatformPackageApi.testProxyConnection, {
		manual: true,
		onSuccess: (res) => {
			connectionResultMap.set(info!.id, res)
		},
	})

	const testConnection = useMemoizedFn(async () => {
		if (!info?.id) return
		run(info.id)
	})

	/* 查看错误详情 */
	const checkErrorDetail = (res: { text: string; error?: string }) => {
		openModal(FailDetailModal, {
			currentResult: res,
			zIndex: 1002,
		})
	}

	/* 获取测试状态渲染 */
	const getTestStatusRender = () => {
		if (!info) return null
		const result = connectionResultMap.get(info.id)

		if (!result) return null
		const isError = !result.success
		const text = isError ? t("testStatusError") : t("testStatusNormal")
		return (
			<Flex gap={4} className={cx(styles.testStatus, isError && styles.error)} align="center">
				{isError ? (
					<IconCircleXFilled
						color="currentColor"
						size={20}
						onClick={() => {
							if (isMobile) {
								checkErrorDetail({
									text,
									error: result.details?.error,
								})
							}
						}}
					/>
				) : (
					<IconCircleCheckFilled color="currentColor" size={20} />
				)}

				{!isMobile && (
					<>
						<div>{t("testStatus", { status: text })}</div>
						{isError && (
							<div
								className={styles.checkDetail}
								onClick={() =>
									checkErrorDetail({
										text,
										error: result.details?.error,
									})
								}
							>
								{t("checkDetail")}
							</div>
						)}
					</>
				)}
			</Flex>
		)
	}

	const footer = info ? (
		<Flex
			align="center"
			justify={justify || (connectionResultMap.get(info.id) ? "space-between" : "flex-end")}
			gap={20}
		>
			{getTestStatusRender()}
			<MagicButton
				size="middle"
				type={justify ? "default" : "primary"}
				disabled={!info?.id}
				loading={loading}
				onClick={testConnection}
			>
				{t("testConnection")}
			</MagicButton>
		</Flex>
	) : null

	return {
		footer,
	}
}
