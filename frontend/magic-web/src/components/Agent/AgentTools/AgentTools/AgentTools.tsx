import { IconX, IconChevronDown } from "@tabler/icons-react"
import { AgentCommonModalChildrenProps } from "@/components/Agent/AgentCommonModal"
import { Select, Form, Input, Checkbox } from "antd"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import MagicSpin from "@/components/base/MagicSpin"
import CollapseItem from "./CollapseItem"
import { useDeepCompareEffect, useMemoizedFn, useRequest } from "ahooks"
import { FlowApi } from "@/apis"
import { useTranslation } from "react-i18next"
import { useImmer } from "use-immer"
import type { Flow, UseableToolSet } from "@/types/flow"

export interface AgentTools extends AgentCommonModalChildrenProps {
	id?: string
	/** IDs of selected tools. */
	usableCache?: Array<string>
	/** Custom tool addition handler. */
	onAdd?: (info: Flow.Mcp.SaveParams) => void
	/** Callback invoked after a successful operation. */
	onSuccessCallback?: () => void
}

export default function AgentTools(props: AgentTools) {
	const { id, onClose, onSuccessCallback } = props

	const { t } = useTranslation("agent")

	/** Saved form data */
	const [usableCache, setUsableCache] = useImmer<Set<string>>(new Set())

	/** Available tool sets. */
	const [toolListData, setToolListData] = useImmer<UseableToolSet.Item[]>([])

	const { loading } = useRequest(FlowApi.getUseableToolList, {
		onSuccess(data) {
			// Initialize the available tool sets.
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

	// Update the tools in the matching tool set.
	const onToolsUpdate = useMemoizedFn((toolsetId: string, tools: UseableToolSet.UsableTool[]) => {
		setToolListData((preState) => {
			const targetIndex = preState.findIndex((item) => item.id === toolsetId)
			if (targetIndex !== -1) {
				preState[targetIndex].tools = tools
			}
		})
	})

	return (
		<div className="w-full overflow-hidden rounded-[12px]">
			<div className="flex items-center justify-between border-b border-border px-5 py-2.5 text-base font-semibold not-italic leading-[22px] text-foreground/80 backdrop-blur-[12px]">
				{t("common.tool.import")}
				<div
					className="flex size-6 cursor-pointer items-center justify-center rounded-[6px] transition-all duration-100 ease-linear hover:bg-fill active:bg-fill-secondary dark:hover:bg-white/10 dark:active:bg-white/[0.15]"
					onClick={onClose}
				>
					<IconX size={24} />
				</div>
			</div>
			<div className="flex flex-col gap-2 py-2.5">
				<Form
					className="flex h-8 w-full items-center justify-between px-2.5 [&_.magic-form-item-label]:after:!hidden"
					colon={false}
				>
					<div className="flex items-center">
						<Form.Item
							name="sort"
							label={t("common.tool.menu.sort")}
							className="mb-0"
							initialValue="default"
						>
							<Select
								variant="borderless"
								className="w-[100px]"
								suffixIcon={<IconChevronDown size={18} />}
							>
								<Select.Option key="default" value="default">
									{t("common.tool.menu.popular")}
								</Select.Option>
							</Select>
						</Form.Item>
					</div>
					<div className="flex items-center gap-2.5">
						<Form.Item name="name" className="mb-0">
							<Input placeholder={t("common.tool.menu.search")} />
						</Form.Item>
						<Form.Item name="name" className="mb-0">
							<Checkbox>{t("common.tool.menu.onlyShowOfficial")}</Checkbox>
						</Form.Item>
					</div>
				</Form>
				<MagicSpin spinning={loading}>
					{/* Limit the viewport height so the list grows with its content and scrolls within 70vh. */}
					<ScrollArea
						type="always"
						className="w-full"
						viewportClassName="min-h-[300px] max-h-[70vh] px-2.5 [&>div]:!block"
					>
						{toolListData?.map((item) => (
							<CollapseItem
								key={item?.id}
								item={item}
								usableCache={usableCache}
								onToolAdd={onToolAdd}
								onToolsUpdate={onToolsUpdate}
							/>
						))}
					</ScrollArea>
				</MagicSpin>
			</div>
		</div>
	)
}
