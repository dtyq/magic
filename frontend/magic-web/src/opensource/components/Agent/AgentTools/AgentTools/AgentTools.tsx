import { useStyles } from "./styles"
import { IconX, IconChevronDown } from "@tabler/icons-react"
import { AgentCommonModalChildrenProps } from "@/opensource/components/Agent/AgentCommonModal"
import { Flex, Select, Form, Input, Checkbox } from "antd"
import MagicScrollBar from "@/opensource/components/base/MagicScrollBar"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import CollapseItem from "./CollapseItem"
import { useDeepCompareEffect, useMemoizedFn, useRequest } from "ahooks"
import { FlowApi } from "@/opensource/apis"
import { useTranslation } from "react-i18next"
import { useImmer } from "use-immer"
import type { Flow, UseableToolSet } from "@/opensource/types/flow"

export interface AgentTools extends AgentCommonModalChildrenProps {
	id?: string
	/** 已选择工具 Ids */
	usableCache?: Array<string>
	/** 自定义添加行为 */
	onAdd?: (info: Flow.Mcp.SaveParams) => void
	/** 操作成功回调 */
	onSuccessCallback?: () => void
}

export default function AgentTools(props: AgentTools) {
	const { id, onClose, onSuccessCallback } = props

	const { styles } = useStyles()
	const { t } = useTranslation("agent")

	/** Saved form data */
	const [usableCache, setUsableCache] = useImmer<Set<string>>(new Set())

	/** 工具列表数据 */
	const [toolListData, setToolListData] = useImmer<UseableToolSet.Item[]>([])

	const { loading } = useRequest(FlowApi.getUseableToolList, {
		onSuccess(data) {
			// 初始化工具列表数据
			setToolListData(data?.list || [])
			onSuccessCallback?.()
		},
	})

	const { run, refresh } = useRequest(FlowApi.getMcpToolList, {
		manual: true,
		onSuccess(data) {
			setUsableCache((preState) => {
				data?.list?.map((i) => {
					preState.add(i.rel_code)
				})
			})
		},
	})

	useDeepCompareEffect(() => {
		if (Array.isArray(props?.usableCache)) {
			setUsableCache(new Set(props?.usableCache))
		}
	}, [props?.usableCache])

	useDeepCompareEffect(() => {
		if (id) {
			run(id)
		}
	}, [id])

	const onToolAdd = useMemoizedFn(async (tool: UseableToolSet.UsableTool, toolSetId: string) => {
		if (props?.onAdd) {
			setUsableCache((preState) => {
				preState.add(tool.code)
			})
			props?.onAdd?.({
				...tool,
				rel_code: tool?.code,
				source: 1,
				rel_info: {
					tool_set_id: toolSetId,
				},
			})
		} else {
			await FlowApi.saveMcpTool(
				{
					...tool,
					rel_code: tool?.code,
					source: 1,
					rel_info: {
						tool_set_id: toolSetId,
					},
				},
				id || "",
			)
			refresh?.()
			onSuccessCallback?.()
		}
	})

	// 处理工具列表更新
	const onToolsUpdate = useMemoizedFn((toolsetId: string, tools: UseableToolSet.UsableTool[]) => {
		setToolListData((preState) => {
			const targetIndex = preState.findIndex((item) => item.id === toolsetId)
			if (targetIndex !== -1) {
				preState[targetIndex].tools = tools
			}
		})
	})

	return (
		<div className={styles.layout}>
			<div className={styles.header}>
				{t("common.tool.import")}
				<div className={styles.close} onClick={onClose}>
					<IconX size={24} />
				</div>
			</div>
			<div className={styles.wrapper}>
				<Form className={styles.wrapperHeader} colon={false}>
					<Flex align="center">
						<Form.Item
							name="sort"
							label={t("common.tool.menu.sort")}
							className={styles.formItem}
							initialValue="default"
						>
							<Select
								variant="borderless"
								style={{ width: 100 }}
								suffixIcon={<IconChevronDown size={18} />}
							>
								<Select.Option key="default" value="default">
									{t("common.tool.menu.popular")}
								</Select.Option>
							</Select>
						</Form.Item>
					</Flex>
					<Flex align="center" gap={10}>
						<Form.Item name="name" className={styles.formItem}>
							<Input placeholder={t("common.tool.menu.search")} />
						</Form.Item>
						<Form.Item name="name" className={styles.formItem}>
							<Checkbox>{t("common.tool.menu.onlyShowOfficial")}</Checkbox>
						</Form.Item>
					</Flex>
				</Form>
				<MagicSpin spinning={loading}>
					<MagicScrollBar className={styles.wrapperBody} autoHide={false}>
						{toolListData?.map((item) => (
							<CollapseItem
								key={item?.id}
								item={item}
								usableCache={usableCache}
								onToolAdd={onToolAdd}
								onToolsUpdate={onToolsUpdate}
							/>
						))}
					</MagicScrollBar>
				</MagicSpin>
			</div>
		</div>
	)
}
