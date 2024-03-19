import { Col, Flex, message } from "antd"
import { lazy, memo, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { MagicButton, MagicSwitch } from "components"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import type { AiManage } from "@/types/aiManage"
import { AiModel } from "@/const/aiModel"
import { useApis } from "@/apis"
import { PERMISSION_KEY_MAP } from "@/const/common"
import useRights from "@/hooks/useRights"
import { useAdmin } from "@/provider/AdminProvider"
import { RouteName } from "@/const/routes"
import { useOpenModal } from "@/hooks/useOpenModal"
import { useAdminStore } from "@/stores/admin"
import { useStyles } from "./styles"
import { AddServiceModal } from "../AddServiceModal"
import PageLoading from "../PageLoading"
import CommonList from "../CommonList"

const AddServiceComp = lazy(() => import("../AddModuleBox"))

interface TabListProps {
	/** 服务提供商类型 */
	category: AiModel.ServiceProviderCategory
	/** 类名 */
	className?: string
	/** 样式 */
	style?: React.CSSProperties
}

const ServiceProviderList = ({ category, className, style }: TabListProps) => {
	const { t } = useTranslation("admin/ai/model")
	const { t: tCommon } = useTranslation("admin/common")

	const { isOfficialOrg } = useAdminStore()

	const { AIManageApi } = useApis()
	const openModal = useOpenModal()

	const { styles } = useStyles()

	const { isPrivateDeployment, navigate } = useAdmin()

	const [list, setList] = useState<AiManage.ServiceProviderList[]>([])

	const { run: trigger, loading } = useRequest(
		() =>
			isOfficialOrg
				? AIManageApi.getServiceProviderList(category)
				: AIManageApi.getServiceProviderListNonOfficial(category),
		{
			manual: true,
			onSuccess: (response) => {
				setList(
					response.sort((a, b) => {
						// 将官方提供商排在前面
						if (
							a.provider_type === AiModel.ProviderType.Official &&
							b.provider_type !== AiModel.ProviderType.Official
						) {
							return -1
						}
						if (
							a.provider_type !== AiModel.ProviderType.Official &&
							b.provider_type === AiModel.ProviderType.Official
						) {
							return 1
						}
						return 0
					}),
				)
			},
		},
	)

	const { runAsync: updateInfo } = useRequest(
		(params: AiManage.UpdateServiceProviderParams) =>
			isOfficialOrg
				? AIManageApi.updateServiceProviderInfo(params)
				: AIManageApi.updateServiceProviderInfoNonOfficial(params),
		{ manual: true },
	)

	useMount(() => {
		trigger()
	})

	const onChange = async (checked: boolean, item: AiManage.ServiceProviderList) => {
		const { id, config, translate, alias, sort, provider_code } = item
		updateInfo({
			id,
			status: checked ? AiModel.Status.Enabled : AiModel.Status.Disabled,
			config,
			alias,
			translate,
			sort,
			provider_code,
		}).then(() => {
			message.success(tCommon("message.updateSuccess"))
			const newStatus = checked ? AiModel.Status.Enabled : AiModel.Status.Disabled
			// 在原数据上修改，不重新请求
			setList((prevList) =>
				prevList.map((it) => (it.id === id ? { ...it, status: newStatus } : it)),
			)
		})
	}

	const openDetail = (id: string) => {
		if (isOfficialOrg) {
			navigate({
				name:
					category === AiModel.ServiceProviderCategory.LLM
						? RouteName.AdminPlatformAIModelDetails
						: RouteName.AdminPlatformAIDrawingDetails,
				params: { id },
			})
		} else {
			navigate({
				name:
					category === AiModel.ServiceProviderCategory.LLM
						? RouteName.AdminAIModelDetails
						: RouteName.AdminAIDrawingDetails,
				params: { id },
			})
		}
	}

	/* 官方组织权限 */
	const hasOfficialPermission = useRights(
		category === AiModel.ServiceProviderCategory.LLM
			? PERMISSION_KEY_MAP.PLATFORM_MODEL_MANAGEMENT_EDIT
			: PERMISSION_KEY_MAP.PLATFORM_INTELLIGENT_DRAWING_EDIT,
	)

	/* 企业/团队组织权限 */
	const hasNonOfficialPermission = useRights(
		category === AiModel.ServiceProviderCategory.LLM
			? PERMISSION_KEY_MAP.MODEL_MANAGEMENT_EDIT
			: PERMISSION_KEY_MAP.INTELLIGENT_DRAWING_EDIT,
	)

	const hasEditRight = isOfficialOrg ? hasOfficialPermission : hasNonOfficialPermission

	const getEditRight = useMemoizedFn((provider_type: AiModel.ProviderType) => {
		const isPrivate = isPrivateDeployment
		// 非私有化环境且是官方类型，无权限操作
		if (!isPrivate && provider_type === AiModel.ProviderType.Official) {
			return false
		}
		return hasEditRight
	})

	const leftAction = useMemoizedFn((item: AiManage.ServiceProviderList) => {
		const { status, provider_type } = item
		return (
			<Flex gap={8} align="center">
				<div className={styles.status}>{t("status")}</div>
				<MagicSwitch
					checked={status === AiModel.Status.Enabled}
					disabled={!getEditRight(provider_type)}
					onChange={(checked: boolean) => onChange(checked, item)}
				/>
			</Flex>
		)
	})

	const rightAction = useMemoizedFn((item: AiManage.ServiceProviderList) => {
		const { id, provider_type: type } = item
		return type === AiModel.ProviderType.Official ? (
			<Flex gap={10} align="center">
				{getEditRight(type) && (
					<MagicButton
						type="link"
						onClick={() => openDetail(id)}
						className={styles.button}
					>
						{t("manageModel")}
					</MagicButton>
				)}
			</Flex>
		) : (
			<MagicButton type="link" onClick={() => openDetail(id)} className={styles.button}>
				{t("serviceConfig")}
			</MagicButton>
		)
	})

	const content = useMemo(() => {
		return [
			{
				id: AiModel.Status.Enabled,
				title: t("enabledServiceProvider"),
				data: list?.filter((item) => item.status === AiModel.Status.Enabled),
			},
			{
				id: AiModel.Status.Disabled,
				title: t("noEnabledServiceProvider"),
				data: list?.filter((item) => item.status === AiModel.Status.Disabled),
			},
		]
	}, [list, t])

	const handleAddClick = (id: AiModel.Status) => {
		if (!hasEditRight) return
		openModal(AddServiceModal, {
			category,
			selectedStatus: id,
			onOk: trigger,
		})
	}

	if (loading) return <PageLoading />

	return (
		<CommonList<AiManage.ServiceProviderList>
			content={content}
			className={className}
			style={style}
			rightAction={rightAction}
			leftAction={leftAction}
			emptyComponent={(id) =>
				hasEditRight && (
					<Col xs={24} sm={24} md={12} lg={8} xl={6}>
						<AddServiceComp
							onAddClick={() => handleAddClick(id)}
							hasEditRight={hasEditRight}
							text={t("addServiceProvider")}
						/>
					</Col>
				)
			}
		/>
	)
}

export default memo(ServiceProviderList)
