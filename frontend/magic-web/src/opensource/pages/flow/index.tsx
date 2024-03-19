/**
 * magic-flow节点业务组件
 */
import MagicButton from "@/opensource/components/base/MagicButton"
import { useTranslation } from "react-i18next"
import type { MagicFlowInstance, NodeSchema } from "@dtyq/magic-flow/dist/MagicFlow"
import MagicFlowComponent from "@dtyq/magic-flow/dist/MagicFlow"
import { MaterialSourceProvider } from "@dtyq/magic-flow/dist/MagicFlow/context/MaterialSourceContext/MaterialSourceContext"
import { NodeMapProvider } from "@dtyq/magic-flow/dist/common/context/NodeMap/Provider"
import { ToastContainer } from "react-toastify"
import { NodeChangeListenerProvider } from "@dtyq/magic-flow/dist/MagicFlow/context/NodeChangeListenerContext/NodeChangeListenerContext"
import { ExtraNodeConfigProvider } from "@dtyq/magic-flow/dist/MagicFlow/context/ExtraNodeConfigContext/Provider"
import { useEffect, useMemo, useRef, useState } from "react"
import { ConfigProvider } from "antd"
import { useMemoizedFn, useSize } from "ahooks"
import { FlowType, type TestResult, type TriggerConfig } from "@/opensource/types/flow"
import locale from "antd/es/locale/zh_CN"
import { IconChevronLeft, IconMenu2 } from "@tabler/icons-react"
import DefaultImage from "@/opensource/assets/logos/agent-avatar.jpg"
import { cx } from "antd-style"
import { useLocation, useParams } from "react-router"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { customNodeType, OmitNodeKeys } from "./constants"
import { installAllNodes } from "./utils"
import styles from "./index.module.less"
import TestFlowButton from "./components/TestFlowButton"
import { CustomFlowProvider } from "./context/CustomFlowContext/Provider"
import DraftListButton from "./components/DraftListButton"
import PublishFlowButton from "./components/PublishFlowButton"
import GlobalVariablesButton from "./components/GlobalVariablesButton/GlobalVariablesButton"
import PublishListButton from "./components/PublishListButton"
import { ResourceTypes } from "./components/AuthControlButton/types"
import { shadowFlow } from "./utils/helpers"
import useAgent from "./hooks/useAgent"
import useFlowDetail from "./hooks/useFlowDetail"
import useCheckType from "./hooks/useCheckType"
import useEditAgentModal from "./hooks/useEditAgentModal"
import AgentInfoButton from "./components/AgentInfoButton"
import PublishAgentButton from "./components/PublishAgentButton"
import AuthControlButton from "./components/AuthControlButton/AuthControlButton"
import QuickInstructionButton from "./components/QuickInstructionButton"
import useRights from "./hooks/useRights"
import useAutoSave from "./hooks/useAutoSave"
import useCustomTagList from "./hooks/useCustomTagList"
import "react-toastify/dist/ReactToastify.css"
import useDataInit from "./hooks/useDataInit"
import OperateMenu from "./components/OperateMenu"
import ApiKeyButton from "./components/ApikeyButton"
import useChangeListener from "./hooks/useChangeListener"
import useDraftToast from "./hooks/useDraftToast"
import { generateNodeVersionSchema } from "./utils/version"
import useEvent from "./hooks/useEvent"
import "./override.css"
import useMaterialSource from "./hooks/useMaterialSource"
import FlowAssistant from "./components/FlowAssistant/index"
import { useGlobalLanguage } from "@/opensource/models/config/hooks"
import { service } from "@/opensource/services"
import type { FlowService } from "@/opensource/services/flow"
import { ComponentVersionMap } from "./nodes"
import CommercialProvider from "./context/CommercialContext"
import FlowInstanceProvider from "./context/FlowInstanceContext"
import { RouteName } from "@/opensource/routes/constants"
import FlowProvider from "@/opensource/providers/FlowProvider"
import { botStore } from "@/opensource/stores/bot"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

export type BaseFlowProps = {
	extraData?: {
		canReferenceNodeTypes: string[]
		getEnterpriseSchemaConfigMap: () => Record<string, NodeSchema>
		extraNodeInfos: any
		enterpriseNodeComponentVersionMap: Record<string, Record<string, ComponentVersionMap>>
		enterpriseNodeTypes: Record<string, string>
	}
	/** 通用标识符，用于覆盖路由参数中的id，可以是 toolCode、agentId、subFlowId 等 */
	id?: string
	/** 是否为 Agent 详情页，用于非路由场景 */
	isAgent?: boolean
	/** 流程类型，用于非路由场景判断 */
	flowType?: string
	/** 自定义返回按钮行为，用于非路由场景（如 Modal） */
	onBack?: () => void
	/** 是否在 Modal 中渲染，影响某些UI行为 */
	inModal?: boolean
}

function BaseFlow({
	extraData,
	id,
	isAgent: isAgentProp,
	flowType,
	onBack,
	inModal = false,
}: BaseFlowProps) {
	const navigate = useNavigate() // 在组件内
	const location = useLocation()
	const params = useParams()
	const { t } = useTranslation()

	// 是否正在试运行
	const [isTesting, setIsTesting] = useState(false)
	// 是否显示FlowAssistant
	const [showFlowAssistant, setShowFlowAssistant] = useState(false)

	const flowInstance = useRef(null as null | MagicFlowInstance)

	const flowInteractionRef = useRef(null as any)

	// 监听语言变化，重新安装节点
	const language = useGlobalLanguage(true)

	const isCommercial = useMemo(() => {
		return !!extraData
	}, [extraData])

	useEffect(() => {
		installAllNodes(extraData)
	}, [language, extraData])

	// 浏览器相关事件拦截处理
	useEvent()

	const size = useSize(document.body)

	const isCollapse = useMemo(() => {
		return size?.width && size.width <= 1500
	}, [size?.width])

	// AI 助理相关状态
	const { agent, setAgent, initAgentPublishList } = useAgent()

	const { showFlowIsDraftToast } = useDraftToast()

	// 流程相关状态
	const { currentFlow, setCurrentFlow, initDraftList, initPublishList } = useFlowDetail({
		agent,
		showFlowIsDraftToast,
		id,
		inModal,
	})

	// 收集初次加载依赖的数据并挂载到store
	useDataInit({ currentFlow })

	// 当前是否为Agent详情
	const { isAgent } = useCheckType({ id, isAgentOverride: isAgentProp })

	// 当前的权限
	const { isEditRight, isAdminRight, isReleasedToMarket } = useRights({
		flow: currentFlow!,
		agent,
	})

	const { lastSaveTime, isSaving, saveDraft } = useAutoSave({
		flowInstance,
		isAgent,
		initDraftList,
		setCurrentFlow,
	})

	const { nodeChangeEventListener } = useChangeListener({ saveDraft })

	// Agent编辑弹层
	const { EditAgentModal, openAddAgentModal } = useEditAgentModal({
		agent,
		setAgent,
		currentFlow,
		setCurrentFlow,
	})

	const [testResult, setTestResult] = useState<TestResult["node_debug"]>()

	useEffect(() => {
		if (currentFlow?.id && !currentFlow?.icon) {
			let icon = ""
			// @ts-ignore
			if (currentFlow?.type === FlowType.Main) {
				icon = botStore.defaultIcon.icons.bot
				// @ts-ignore
			} else if (currentFlow?.type === FlowType.Tools) {
				icon = botStore.defaultIcon.icons.tool_set
			} else {
				icon = botStore.defaultIcon.icons.flow
			}

			if (!icon) return

			setCurrentFlow({
				...currentFlow,
				icon,
			})
		}
	})

	const testFlow = useMemoizedFn(async (triggerConfig: TriggerConfig, closeModal: () => void) => {
		const flow = flowInstance?.current?.getFlow()
		// console.log("内部流程", flow, serverFlow)
		if (!flow) return
		setIsTesting(true)
		const shadowedFlow = shadowFlow(flow)
		try {
			const res = await service.get<FlowService>("flowService").testFlow({
				...shadowedFlow,
				trigger_config: triggerConfig,
			})
			setTestResult(res.node_debug)
			setIsTesting(false)
			if (res?.success) {
				magicToast.success(t("common.testSuccess", { ns: "flow" }))
			} else {
				magicToast.error(t("common.testFail", { ns: "flow" }))
			}
			closeModal?.()
		} catch (err) {
			setIsTesting(false)
		}
	})

	const getDropdownItems = useMemoizedFn(() => {
		return (
			<>
				{isAgent && isAdminRight && isReleasedToMarket && (
					<MagicButton justify="flex-start" size="large" type="text" block>
						<AuthControlButton
							Icon
							resourceId={agent.botEntity.id as string}
							resourceType={ResourceTypes.Agent}
						/>
					</MagicButton>
				)}
				{isEditRight && (
					<MagicButton justify="flex-start" size="large" type="text" block>
						<ApiKeyButton flow={currentFlow!} Icon isAgent={isAgent} />
					</MagicButton>
				)}
				<div className={styles.divider} />
				<MagicButton justify="flex-start" size="large" type="text" block>
					<GlobalVariablesButton
						Icon
						flow={currentFlow}
						hasEditRight={isEditRight || isAdminRight}
						flowInstance={flowInstance}
					/>
				</MagicButton>
				{isAgent && isEditRight && (
					<MagicButton justify="flex-start" size="large" type="text" block>
						<QuickInstructionButton agent={agent} Icon />
					</MagicButton>
				)}
			</>
		)
	})

	const moreIcon = useMemo(() => {
		return (
			<MagicButton
				className={styles.moreIcon}
				icon={<IconMenu2 size={16} color="#000000" />}
			/>
		)
	}, [])

	const isMainFlow = useMemo(() => {
		if (!currentFlow) return true
		// @ts-ignore
		return currentFlow?.type === FlowType.Main
	}, [currentFlow])

	const Buttons = useMemo(() => {
		return (
			<>
				{isAgent && (
					<>
						<AgentInfoButton agent={agent} isAdminRight={isAdminRight} />
						{!isCollapse && isAdminRight && isReleasedToMarket && (
							<AuthControlButton
								resourceId={agent.botEntity.id as string}
								resourceType={ResourceTypes.Agent}
							/>
						)}
					</>
				)}
				{isCollapse && (
					<OperateMenu
						useIcon
						Icon={moreIcon}
						menuItems={getDropdownItems()}
						trigger="click"
					/>
				)}
				<div className={styles.line} />
				{!isCollapse && (
					<>
						<GlobalVariablesButton
							flow={currentFlow}
							hasEditRight={isEditRight || isAdminRight}
							flowInstance={flowInstance}
						/>
						{isAgent && isEditRight && <QuickInstructionButton agent={agent} />}

						<div className={styles.line} />
						{isEditRight && <ApiKeyButton flow={currentFlow!} isAgent={isAgent} />}
					</>
				)}
				{isEditRight && <PublishListButton isAgent={isAgent} flow={currentFlow} />}
				{isEditRight && (
					<>
						<DraftListButton
							flow={currentFlow}
							flowInstance={flowInstance}
							initDraftList={initDraftList}
							showFlowIsDraftToast={showFlowIsDraftToast}
						/>
						<TestFlowButton
							onFinished={testFlow}
							loading={isTesting}
							flow={currentFlow}
							flowInstance={flowInstance}
						/>
						{/* 添加AI助手按钮 */}

						{/* {isEditRight && isCommercial && (
							<MagicButton
								onClick={() => setShowFlowAssistant((prev) => !prev)}
								icon={<IconRobot size={16} />}
							>
								{t("common.flowAssistant", { ns: "flow" })}
							</MagicButton>
						)} */}

						{/* <SaveDraftButton
							flowInstance={flowInstance}
							flow={currentFlow}
							initDraftList={initDraftList}
						/> */}
						{!isAgent && (
							<PublishFlowButton
								flowInstance={flowInstance}
								flow={currentFlow}
								isMainFlow={isMainFlow}
								initPublishList={initPublishList}
							/>
						)}
					</>
				)}

				{isAgent && isEditRight && (
					<PublishAgentButton
						agent={agent}
						setAgent={setAgent}
						flowInstance={flowInstance}
						initPublishList={initAgentPublishList}
					/>
				)}
			</>
		)
	}, [
		isAgent,
		agent,
		isAdminRight,
		isCollapse,
		isReleasedToMarket,
		moreIcon,
		getDropdownItems,
		currentFlow,
		isEditRight,
		initDraftList,
		showFlowIsDraftToast,
		testFlow,
		isTesting,
		t,
		isMainFlow,
		initPublishList,
		setAgent,
		initAgentPublishList,
	])

	const navigateBack = useMemoizedFn(() => {
		// 如果是 Modal 模式且提供了自定义返回行为，直接使用
		if (inModal && onBack) {
			onBack()
			return
		}

		// 检查历史记录栈中是否有前一页
		if (window.history.length <= 1 || !window.history.state) {
			// 从URL或params中获取type，非路由场景使用传入的 flowType
			const type = params.type || flowType || location.pathname.split("/").filter(Boolean)[1]

			if (type) {
				// 有type参数时，返回对应类型的列表页面
				navigate({ name: RouteName.Flows, params: { type } })
			} else {
				// 没有type参数时，默认返回Agent列表
				navigate({ name: RouteName.AgentList })
			}
		} else {
			// 有历史记录时，正常返回
			window.history.back()
		}
	})

	// 自定义tag列表
	const { customTags } = useCustomTagList({
		flow: currentFlow,
		isMainFlow,
		isSaving,
		lastSaveTime,
		isAgent,
		agent,
		setCurrentFlow,
	})

	const flowHeader = useMemo(() => {
		return {
			buttons: Buttons,
			backIcon: (
				<IconChevronLeft stroke={2} className={styles.backIcon} onClick={navigateBack} />
			),
			defaultImage: DefaultImage,
			editEvent: isAgent
				? () => {
						// TODO2 Agent 处理剩余编辑基础信息的相关接口调用和回显处理
						openAddAgentModal()
					}
				: null,
			customTags,
		}
	}, [Buttons, navigateBack, isAgent, customTags, openAddAgentModal])

	const nodeSchemaMap = useMemo(() => {
		return generateNodeVersionSchema(
			extraData?.enterpriseNodeComponentVersionMap || {},
			extraData?.getEnterpriseSchemaConfigMap || (() => ({})),
			extraData?.enterpriseNodeTypes || {},
		)
	}, [extraData])

	const { subFlow, tools } = useMaterialSource()

	const nodeStyleMap = useMemo(() => {
		return {
			[customNodeType.Start]: {
				width: isMainFlow ? "480px" : "900px",
			},
		}
	}, [isMainFlow])

	return (
		<FlowInstanceProvider flowInstance={flowInstance}>
			<CommercialProvider extraData={extraData}>
				<NodeMapProvider nodeMap={nodeSchemaMap}>
					{/* @ts-ignore */}
					<MaterialSourceProvider subFlow={subFlow} tools={tools}>
						{/* @ts-ignore */}
						<NodeChangeListenerProvider customListener={nodeChangeEventListener}>
							<ExtraNodeConfigProvider nodeStyleMap={nodeStyleMap}>
								{/* @ts-ignore */}
								<ConfigProvider locale={locale}>
									<CustomFlowProvider
										testFlowResult={testResult}
										setCurrentFlow={setCurrentFlow}
									>
										<div
											className={cx(styles.flowWrapper, {
												// [styles.mainFlow]: isMainFlow,
											})}
										>
											{/* @ts-ignore */}
											<MagicFlowComponent
												header={flowHeader}
												showExtraFlowInfo={false}
												ref={flowInstance}
												flow={currentFlow}
												onlyRenderVisibleElements
												layoutOnMount={false}
												allowDebug
												// @ts-ignore
												flowInteractionRef={flowInteractionRef}
												omitNodeKeys={OmitNodeKeys}
											/>
										</div>

										{/* 添加FlowAssistant组件 */}
										{isCommercial && showFlowAssistant && isEditRight && (
											<FlowAssistant
												flowInteractionRef={flowInteractionRef}
												flow={currentFlow}
												onClose={() => setShowFlowAssistant(false)}
												isAgent={isAgent}
												saveDraft={saveDraft}
												isEditRight={isEditRight}
											/>
										)}

										<ToastContainer
											toastClassName="toast"
											position="top-right"
											autoClose={2000}
											hideProgressBar
											newestOnTop={false}
											closeOnClick
											rtl={false}
											pauseOnFocusLoss
											draggable
											pauseOnHover
											className={styles.toastContainer}
										/>
										{EditAgentModal}
									</CustomFlowProvider>
								</ConfigProvider>
							</ExtraNodeConfigProvider>
						</NodeChangeListenerProvider>
					</MaterialSourceProvider>
				</NodeMapProvider>
			</CommercialProvider>
		</FlowInstanceProvider>
	)
}

export default function Flow(props: BaseFlowProps) {
	return (
		<FlowProvider>
			<BaseFlow {...props} />
		</FlowProvider>
	)
}
