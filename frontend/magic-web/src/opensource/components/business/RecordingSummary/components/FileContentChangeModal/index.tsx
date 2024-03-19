import { Flex } from "antd"
import { memo, useEffect, useState, lazy, Suspense } from "react"
import { useTranslation } from "react-i18next"
import { useBoolean, useMemoizedFn } from "ahooks"
import { RECORD_SUMMARY_EVENTS } from "@/opensource/services/recordSummary/const/events"
import { initializeService } from "@/opensource/services/recordSummary/serviceInstance"

import MagicModal from "@/opensource/components/base/MagicModal"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import type { SelectedContentType } from "../FileContentCompare/types"
import FlexBox from "@/opensource/components/base/FlexBox"
import { useStyles } from "./styles"
import Segment from "../FileContentCompare/components/Segment"
import { useIsMobile } from "@/opensource/hooks/use-mobile"

const FileContentCompare = lazy(() => import("../FileContentCompare"))

interface FileContentChangeModalData {
	currentContent: string
	serverContent: string
	onIgnore: () => void
	onOverride: () => void
	onUseMerge: (mergedContent: string) => void
	onCancel: () => void
}

function FileContentChangeModal() {
	const { t } = useTranslation("super")
	const { styles } = useStyles()
	const [open, setOpen] = useState(true)
	const [modalData, setModalData] = useState<FileContentChangeModalData | null>(null)
	const [selectedType, setSelectedType] = useState<SelectedContentType | null>("merge")
	const [loading, { setTrue: setLoadingTrue, setFalse: setLoadingFalse }] = useBoolean(false)
	const recordSummaryService = initializeService()
	const isMobile = useIsMobile()

	useEffect(() => {
		return recordSummaryService.on(
			RECORD_SUMMARY_EVENTS.FILE_CONTENT_CHANGE_CONFLICT,
			({ currentContent, serverContent, onIgnore, onOverride, onUseMerge, onCancel }) => {
				setSelectedType("merge")
				setLoadingFalse()
				setModalData({
					currentContent,
					serverContent,
					onIgnore,
					onOverride,
					onUseMerge,
					onCancel,
				})
				setOpen(true)
			},
		)
	}, [recordSummaryService, setLoadingFalse])

	const handleClose = useMemoizedFn(() => {
		// Disable closing - user must select a version and confirm
		if (loading) return
		// Do not close modal, user must make a selection
	})

	const handleUseCurrent = useMemoizedFn(async () => {
		if (!modalData || loading) return

		setLoadingTrue()
		try {
			modalData.onIgnore()
			setOpen(false)
			setSelectedType(null)
		} catch (error) {
			console.error("Failed to use current content:", error)
		} finally {
			setLoadingFalse()
		}
	})

	const handleUseServer = useMemoizedFn(async () => {
		if (!modalData || loading) return

		setLoadingTrue()
		try {
			modalData.onOverride()
			setOpen(false)
			setSelectedType(null)
		} catch (error) {
			console.error("Failed to use server content:", error)
		} finally {
			setLoadingFalse()
		}
	})

	const handleUseMerge = useMemoizedFn(async (mergedContent: string) => {
		if (!modalData || loading) return

		setLoadingTrue()
		try {
			modalData.onUseMerge(mergedContent)
			setOpen(false)
			setSelectedType(null)
		} catch (error) {
			console.error("Failed to use merged content:", error)
		} finally {
			setLoadingFalse()
		}
	})

	if (!modalData) {
		return null
	}

	// 	const {
	// 		currentContent = `# 用户登录功能需求文档

	// ## 1. 功能概述
	// 用户可以通过手机号和密码登录系统。

	// ## 2. 功能详情

	// ### 2.1 登录方式
	// - 手机号 + 密码登录
	// - 支持记住密码功能

	// ### 2.2 验证规则
	// - 手机号必须为11位数字
	// - 密码长度6-20位

	// ### 2.3 错误处理
	// - 账号不存在时提示"账号或密码错误"
	// - 密码错误超过3次锁定账户10分钟

	// ## 3. 交互流程
	// 1. 用户输入手机号
	// 2. 用户输入密码
	// 3. 点击登录按钮
	// 4. 系统验证并跳转

	// ## 4. 优先级
	// P0 - 核心功能
	// `,
	// 		serverContent = `# 用户登录功能需求文档

	// ## 1. 功能概述
	// 用户可以通过多种方式登录系统，包括手机号、邮箱和第三方账号。

	// ## 2. 功能详情

	// ### 2.1 登录方式
	// - 手机号 + 密码登录
	// - 手机号 + 验证码登录（新增）
	// - 邮箱 + 密码登录（新增）
	// - 微信扫码登录（新增）
	// - 支持记住密码功能
	// - 支持生物识别（指纹/面容）快捷登录（新增）

	// ### 2.2 验证规则
	// - 手机号必须为11位数字
	// - 邮箱格式需符合标准规范（新增）
	// - 密码长度8-20位，必须包含字母和数字（修改）
	// - 验证码为6位数字，有效期5分钟（新增）

	// ### 2.3 错误处理
	// - 账号不存在时提示"账号或密码错误"
	// - 密码错误超过5次锁定账户30分钟（修改）
	// - 验证码错误超过3次需重新获取（新增）
	// - 网络异常时显示友好提示并支持重试（新增）

	// ### 2.4 安全策略（新增章节）
	// - 登录成功后生成JWT Token，有效期7天
	// - 支持多设备同时登录，最多5个设备
	// - 异地登录时发送安全提醒通知

	// ## 3. 交互流程
	// 1. 用户选择登录方式（新增）
	// 2. 用户输入手机号或邮箱（修改）
	// 3. 用户输入密码或获取验证码（修改）
	// 4. 点击登录按钮
	// 5. 系统验证并跳转
	// 6. 首次登录展示欢迎引导页（新增）

	// ## 4. 优先级
	// P0 - 核心功能（手机号+密码、手机号+验证码）
	// P1 - 重要功能（邮箱登录、微信扫码）（新增）
	// P2 - 优化功能（生物识别）（新增）

	// ## 5. 相关链接（新增章节）
	// - UI设计稿：https://figma.com/xxx
	// - 接口文档：https://api-doc.com/xxx`,
	// 	} = modalData || {}

	const { currentContent = "", serverContent = "" } = modalData || {}

	return (
		<MagicModal
			open={open}
			title={
				<FlexBox
					gap={12}
					align={isMobile ? "flex-start" : "center"}
					vertical={isMobile}
					justify="space-between"
					style={{ width: "100%" }}
				>
					<FlexBox gap={2} vertical>
						{t("recordingSummary.fileChangeModal.title")}
						<div className={styles.titleDescription}>
							{t("recordingSummary.fileChangeModal.content")}
						</div>
					</FlexBox>
					<Segment selectedType={selectedType} onChange={setSelectedType} />
				</FlexBox>
			}
			onCancel={handleClose}
			centered
			className={styles.modal}
			maskClosable={false}
			keyboard={false}
			closable={false}
			width={1200}
			footer={null}
			destroyOnHidden
			classNames={{
				content: styles.content,
			}}
		>
			<Flex vertical gap={12}>
				<Suspense
					fallback={
						<Flex justify="center" align="center" style={{ minHeight: 400 }}>
							<MagicSpin size="large" />
						</Flex>
					}
				>
					<FileContentCompare
						currentContent={currentContent}
						serverContent={serverContent}
						selectedType={selectedType}
						currentLabel={t("recordingSummary.fileChangeModal.currentLabel")}
						serverLabel={t("recordingSummary.fileChangeModal.serverLabel")}
						mergeLabel={t("recordingSummary.fileChangeModal.mergeLabel")}
						showMergePreview={true}
						showFooter={true}
						onUseCurrent={handleUseCurrent}
						onUseServer={handleUseServer}
						onUseMerge={handleUseMerge}
						loading={loading}
					/>
				</Suspense>
			</Flex>
		</MagicModal>
	)
}

export default memo(FileContentChangeModal)
