import { useFlowStore } from "@/stores/flow"
import type { Knowledge } from "@/types/knowledge"
import type { DefaultOptionType } from "antd/es/select"
import { Progress, Tooltip, Flex, Modal, Select, Spin } from "antd"
import type { Dispatch, SetStateAction } from "react"
import { useMemo } from "react"
import { IconCircleCheck, IconCircleX, IconHelp, IconPlus } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { cx } from "antd-style"
import { useTranslation } from "react-i18next"
import { resolveToString } from "@dtyq/es6-template-strings"
import styles from "./TeamshareKnowledgeSelect.module.less"
import RenderLabel from "../KnowledgeDataList/RenderLabel/RenderLabel"
import { KnowledgeStatus } from "../../constants"
import { KnowledgeApi } from "@/apis"

type TeamshareKnowledgeSelectProps = {
	value?: Knowledge.KnowledgeDatabaseItem
	onChange?: (value: Knowledge.KnowledgeDatabaseItem) => void
	options: DefaultOptionType[]
	progressList: Knowledge.KnowledgeDatabaseProgress[]
	setProgressList: Dispatch<SetStateAction<Knowledge.KnowledgeDatabaseProgress[]>>
	initInterval: () => void
}

export default function TeamshareKnowledgeSelectV1({
	value,
	options,
	onChange,
	progressList,
	setProgressList,
	initInterval,
}: TeamshareKnowledgeSelectProps) {
	const { t } = useTranslation()
	const { useableTeamshareDatabase } = useFlowStore()

	const currentProgressItem = useMemo(() => {
		return progressList.find((progress) => progress.business_id === value?.business_id)
	}, [progressList, value?.business_id])

	const percent = useMemo(() => {
		return (
			((currentProgressItem?.completed_num || 0) / (currentProgressItem?.expected_num || 1)) *
			100
		)
	}, [currentProgressItem?.completed_num, currentProgressItem?.expected_num])

	const vectorText = useMemo(() => {
		const map = {
			[KnowledgeStatus.UnVectored]: "",
			[KnowledgeStatus.Vectoring]: t("common.vectoringText", { ns: "flow" }),
			[KnowledgeStatus.Vectored]: t("common.vectoredText", { ns: "flow" }),
			[KnowledgeStatus.VectorFail]: t("common.vectorFailText", { ns: "flow" }),
		} as Record<number, string>
		return map[currentProgressItem?.vector_status] ?? ""
	}, [currentProgressItem?.vector_status, t])

	const tooltip = useMemo(() => {
		const map = {
			[KnowledgeStatus.UnVectored]: "",
			[KnowledgeStatus.Vectoring]: t("common.vectoringDesc", { ns: "flow" }),
			[KnowledgeStatus.Vectored]: t("common.vectoredDesc", { ns: "flow" }),
			[KnowledgeStatus.VectorFail]: t("common.vectorFailDesc", { ns: "flow" }),
		} as Record<number, string>
		return map[currentProgressItem?.vector_status] ?? ""
	}, [currentProgressItem?.vector_status, t])

	const createKnowledgeDatabaseVector = useMemoizedFn(async (businessId) => {
		setProgressList(
			progressList.filter((progress) => progress.business_id !== value?.business_id),
		)
		await KnowledgeApi.createTeamshareKnowledgeVector({
			knowledge_id: businessId,
		})
		// 需要等待创建完，在开启进度监听
		initInterval()
	})

	const confirmFn = useMemoizedFn(
		(selected: Knowledge.KnowledgeDatabaseItem, type: "new" | "retry") => {
			let content = resolveToString(t("common.firstTimeVectorDesc", { ns: "flow" }), {
				name: selected?.name,
			})
			if (type === "retry") {
				content = resolveToString(t("common.retryVectorDesc", { ns: "flow" }), {
					name: selected?.name,
				})
			}
			Modal.confirm({
				title: t("common.tips", { ns: "flow" }),
				type: "info",
				content,
				onOk: async () => {
					createKnowledgeDatabaseVector(selected.business_id)
				},
				okText: t("common.confirmAndNext", { ns: "flow" }),
			})
		},
	)

	const SuffixComponent = useMemo(() => {
		return (
			<Flex align="center" gap={6} className={cx(styles.suffixComponent)}>
				{currentProgressItem?.vector_status === KnowledgeStatus.Vectoring && (
					<Progress
						className={styles.progress}
						type="circle"
						percent={percent}
						trailColor="#E6E7EA"
						strokeColor="#315CEC"
						strokeWidth={20}
						showInfo={false}
					/>
				)}
				{currentProgressItem?.vector_status === KnowledgeStatus.Vectored && (
					<IconCircleCheck color="#32C436" size={14} />
				)}
				{currentProgressItem?.vector_status === KnowledgeStatus.VectorFail && (
					<IconCircleX color="#FF4D3A" size={14} />
				)}
				<span className={styles.statusText}>{vectorText}</span>
				{currentProgressItem?.vector_status !== KnowledgeStatus.UnVectored && tooltip && (
					<Tooltip title={tooltip}>
						<IconHelp color="#1C1D2399" size={12} />
					</Tooltip>
				)}
				{(currentProgressItem?.vector_status === KnowledgeStatus.Vectored ||
					currentProgressItem?.vector_status === KnowledgeStatus.VectorFail) && (
						<span className={styles.retryText} onClick={() => confirmFn(value!, "retry")}>
							{currentProgressItem?.vector_status === KnowledgeStatus.Vectored
								? t("common.reVector", { ns: "flow" })
								: t("common.retry", { ns: "flow" })}
						</span>
					)}
			</Flex>
		)
	}, [confirmFn, currentProgressItem?.vector_status, percent, t, tooltip, value, vectorText])

	return (
		<Select
			options={options}
			value={value ? value.name : undefined}
			notFoundContent={
				<Flex justify="center">
					<Spin />
				</Flex>
			}
			labelRender={() => (
				<RenderLabel
					item={{
						name: value?.name ?? "",
						business_id: value?.business_id ?? "",
					}}
				/>
			)}
			className={cx("nodrag", styles.select)}
			popupClassName="nowheel"
			getPopupContainer={(triggerNode) => triggerNode.parentNode}
			style={{ width: "100%" }}
			onChange={async (businessId: string) => {
				const selected = useableTeamshareDatabase.find(
					(option) => option.business_id === businessId,
				)
				const response = await KnowledgeApi.getTeamshareKnowledgeProgress({
					knowledge_codes: [selected?.knowledge_code ?? ""],
				})
				// 下一次渲染再调用，避免请求数据是旧的
				setTimeout(() => {
					initInterval()
				}, 0)
				if (response?.list?.length && selected) {
					const progressItems = response?.list
					const currentProgressStatus = progressItems[0]?.vector_status
					if (currentProgressStatus === KnowledgeStatus.UnVectored) {
						confirmFn(selected, "new")
					}
				}
				onChange?.(selected!)
			}}
			suffixIcon={SuffixComponent}
			dropdownRender={(menu) => (
				<div>
					{menu}
					<div
						onClick={(e) => {
							e.stopPropagation()
							window.open(`/wiki`, "_blank")
						}}
						className={styles.addBtn}
					>
						<IconPlus width={20} color="#1C1D23CC" />
						<span>{t("common.addKnowledgeDatabase", { ns: "flow" })}</span>
					</div>
				</div>
			)}
		/>
	)
}
