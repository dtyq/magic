import { Divider, Flex, Form, message, Tooltip } from "antd"
import { memo, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useRequest, useMount, useUnmount } from "ahooks"
import type { Lang } from "components"
import { ButtonGroup, MagicCard, MagicSwitch, MagicButton, WarningModal } from "components"
import { useParams } from "react-router-dom"
import { useApis } from "@/apis"
import type { AiManage } from "@/types/aiManage"
import { AiModel } from "@/const/aiModel"
import useRights from "@/hooks/useRights"
import { PERMISSION_KEY_MAP } from "@/const/common"
import { useOpenModal } from "@/hooks/useOpenModal"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useAdmin } from "@/provider/AdminProvider"
import { useAdminStore } from "@/stores/admin"
import { useStyles } from "./styles"
import ModalList from "../ModalList"
import ApiConfig from "../ApiConfig"
import PageLoading from "../PageLoading"
import ServiceIcon from "../ServiceIcon"

export interface ServiceProviderDetailProps {
	className?: string
	style?: React.CSSProperties
	onDataLoaded: (name: string | null) => void
	reback?: () => void
}
const ServiceProviderDetail = ({
	className,
	style,
	onDataLoaded,
	reback,
}: ServiceProviderDetailProps) => {
	const { t } = useTranslation("admin/ai/model")
	const { t: tCommon } = useTranslation("admin/common")
	const isMobile = useIsMobile()
	const openModal = useOpenModal()

	const { AIManageApi } = useApis()

	const { isPrivateDeployment } = useAdmin()
	const { isOfficialOrg } = useAdminStore()

	const { id } = useParams()
	const [form] = Form.useForm()

	const [langConfig, setLangConfig] = useState<Lang>()
	const [status, setStatus] = useState<boolean>(false)
	const [data, setData] = useState<AiManage.ServiceProviderDetail | null>(null)

	const { runAsync: updateInfo, loading } = useRequest(
		(params: AiManage.UpdateServiceProviderParams) =>
			isOfficialOrg
				? AIManageApi.updateServiceProviderInfo(params)
				: AIManageApi.updateServiceProviderInfoNonOfficial(params),
		{ manual: true, debounceWait: 300 },
	)

	// 是否是官方提供商
	const isOfficial = useMemo(
		() => data?.provider_type === AiModel.ProviderType.Official,
		[data?.provider_type],
	)

	const { styles, cx } = useStyles({ isOfficial, isMobile })

	const isLLM = useMemo(
		() => data?.category === AiModel.ServiceProviderCategory.LLM,
		[data?.category],
	)

	const getServiceProviderDetailData = useMemoizedFn(async () => {
		if (id) {
			const res = isOfficialOrg
				? await AIManageApi.getServiceProviderDetail(id)
				: await AIManageApi.getServiceProviderDetailNonOfficial(id)

			setLangConfig(res?.translate?.alias)
			setStatus(res.status === AiModel.Status.Enabled)
			const newData = res
			setData(newData)
			form.setFieldsValue(newData)
		}
	})

	const handleStatusChange = useMemoizedFn(async (checked: boolean) => {
		try {
			if (checked) {
				await form.validateFields()
			}
			setStatus(checked)
		} catch (error: any) {
			if (error?.errorFields?.[1]?.errors?.[0]) {
				message.error(error.errorFields[1].errors[0])
			} else {
				// console.log(error)
			}
		}
	})

	const titleText = useMemo(
		() => `${data?.name}${data?.alias ? `(${data?.alias})` : ""}`,
		[data?.alias, data?.name],
	)

	/* 官方组织权限 */
	const hasOfficialPermission = useRights(
		data?.category === AiModel.ServiceProviderCategory.LLM
			? PERMISSION_KEY_MAP.PLATFORM_MODEL_MANAGEMENT_EDIT
			: PERMISSION_KEY_MAP.PLATFORM_INTELLIGENT_DRAWING_EDIT,
	)

	/* 企业/团队组织权限 */
	const hasNonOfficialPermission = useRights(
		data?.category === AiModel.ServiceProviderCategory.LLM
			? PERMISSION_KEY_MAP.MODEL_MANAGEMENT_EDIT
			: PERMISSION_KEY_MAP.INTELLIGENT_DRAWING_EDIT,
	)

	const hasEditRight = isOfficialOrg ? hasOfficialPermission : hasNonOfficialPermission

	const showEditButton = useMemo(() => {
		// 官方组织
		if (isOfficialOrg) {
			const isPrivate = isPrivateDeployment
			// 非私有化环境且是官方类型，无权限操作
			if (!isPrivate && isOfficial) {
				return false
			}
		}
		// 个人版本组织有权限, 其他组织通过权限控制
		return hasEditRight
	}, [isOfficialOrg, hasEditRight, isPrivateDeployment, isOfficial])

	const title = useMemo(
		() => (
			<Flex justify="space-between" align="center" flex={1} gap={10}>
				<Tooltip title={titleText}>
					<div className={styles.ellipsis}>{titleText}</div>
				</Tooltip>
				<Flex gap={4} align="center" style={{ flexShrink: 0 }}>
					<span className={styles.status}>{t("status")}</span>
					<Form.Item name="status" noStyle initialValue={status}>
						<MagicSwitch
							checked={status}
							disabled={!showEditButton}
							onChange={handleStatusChange}
							loading={loading}
						/>
					</Form.Item>
				</Flex>
			</Flex>
		),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[showEditButton, titleText, t, status, handleStatusChange, loading],
	)

	const onLangSave = useMemoizedFn((value: AiManage.Lang) => {
		setLangConfig(value)
	})

	const onSave = async () => {
		try {
			let values = null
			if (status) {
				values = await form.validateFields()
			} else {
				// 清除所有字段验证错误
				form.setFields(
					Object.keys(form.getFieldsValue()).map((field) => ({
						name: field,
						errors: [],
					})),
				)
				values = form.getFieldsValue()
			}

			if (!values || !data?.id) return

			const params: AiManage.UpdateServiceProviderParams = {
				id: data.id,
				status: values.status ? AiModel.Status.Enabled : AiModel.Status.Disabled,
				config: values.config,
				alias: values.alias,
				sort: values.sort,
				provider_code: data?.provider_code,
				translate: langConfig
					? {
							alias: {
								...langConfig,
								zh_CN: values.alias,
							},
					  }
					: data?.translate,
			}
			const res = await updateInfo(params)
			if (res) {
				// res是空数据，
				setData((prev) => {
					if (!prev) return prev
					return {
						...prev,
						status: params.status,
						config: params.config,
						alias: params.alias,
						translate: params.translate,
					}
				})
				message.success(tCommon("message.updateSuccess"))
			}
		} catch (error) {
			// console.log(error)
		}
	}

	const onCancel = () => {
		setStatus(data?.status === AiModel.Status.Enabled)
		form.setFieldsValue(data)
	}

	const onDelete = async () => {
		openModal(WarningModal, {
			open: true,
			title: t("form.deleteServiceProvider"),
			content: t("form.deleteServiceProviderDesc"),
			onOk: async () => {
				if (!data?.id) return
				await (isOfficialOrg
					? AIManageApi.deleteServiceProvider(data.id)
					: AIManageApi.deleteServiceProviderNonOfficial(data.id))
				message.success(tCommon("message.deleteSuccess"))
				reback?.()
			},
		})
	}

	useMount(() => {
		getServiceProviderDetailData()
	})

	useEffect(() => {
		if (data) {
			onDataLoaded(data.name)
		}
	}, [data, onDataLoaded])

	useUnmount(() => {
		onDataLoaded(null)
	})

	const hasDeleteButton = useMemo(() => {
		// 官方组织
		if (isOfficialOrg) {
			return isLLM && hasEditRight && !isOfficial
		}
		// 个人版本组织有权限, 其他组织通过权限控制
		return hasEditRight
	}, [isOfficialOrg, hasEditRight, isLLM, isOfficial])

	if (!data) return <PageLoading />

	return (
		<Flex gap={20} vertical className={cx(styles.content, className)} style={style}>
			<Form className={styles.cardContainer} form={form}>
				<MagicCard
					style={{ width: "100%" }}
					title={title}
					avatar={
						<ServiceIcon
							size={50}
							code={data?.provider_code}
							type={data?.provider_type}
							border
							radius={8}
						/>
					}
					description={data?.description || ""}
					className={styles.card}
					is2LineClamp={false}
				/>
				<Divider className={styles.divider} />
				<ApiConfig
					data={data}
					lang={langConfig}
					isOfficial={isOfficial}
					onLangSave={onLangSave}
				/>
				<Flex justify={hasDeleteButton ? "space-between" : "flex-end"} align="center">
					{hasDeleteButton && (
						<MagicButton danger onClick={onDelete} className={styles.deleteButton}>
							{t("form.deleteServiceProvider")}
						</MagicButton>
					)}
					{showEditButton && <ButtonGroup onCancel={onCancel} onSave={onSave} />}
				</Flex>
			</Form>
			<ModalList data={data} setData={setData} hasEditRight={hasEditRight} />
		</Flex>
	)
}

export default memo(ServiceProviderDetail)
