import { Flex, message } from "antd"
import { lazy, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
	DangerLevel,
	MagicButton,
	MagicCard,
	MagicInput,
	MagicSelect,
	MagicSpin,
	MagicSwitch,
	WarningModal,
} from "components"
import { useDebounceFn, useMemoizedFn, useMount, useRequest } from "ahooks"
import { useApis } from "@/apis"
import { PlatformPackage } from "@/types/platformPackage"
import type { AiManage } from "@/types/aiManage"
import { useOpenModal } from "@/hooks/useOpenModal"
import { addAlphaToHex } from "@/utils/color"
import useRights from "@/hooks/useRights"
import { PERMISSION_KEY_MAP } from "@/const/common"
import dynamicModelIcon from "@/assets/logos/dynamic-model-logo.svg"
import { useStyles } from "./styles"
import { AddModeModal } from "./components/AddModeModal"
import { AssignModal } from "./components/AssignModal"
import { IconComponent } from "./utils"

const AddModuleBox = lazy(() => import("../components/AddModuleBox"))

const ModeManagementPage = () => {
	const { t } = useTranslation("admin/platform/mode")
	const { t: tCommon } = useTranslation("admin/common")
	const { styles } = useStyles()

	const { PlatformPackageApi } = useApis()
	const openModal = useOpenModal()

	const [allModelList, setAllModelList] = useState<AiManage.ModelInfo[]>([])
	const [list, setList] = useState<PlatformPackage.Mode[]>([])
	const [total, setTotal] = useState(0)
	const [params, setParams] = useState<PlatformPackage.ModeListParams>({
		page: 1,
		page_size: 100,
	})

	const { runAsync: updateStatus } = useRequest(
		(arg: { id: string; status: boolean }) => PlatformPackageApi.updateModeStatus(arg),
		{ manual: true },
	)

	const { run, loading } = useRequest(PlatformPackageApi.getModeList, {
		manual: true,
		onSuccess: (res, [requestParams]) => {
			const newList = requestParams.page === 1 ? res.list : [...list, ...res.list]
			setList(newList)
			setTotal(res.total)
		},
	})

	const { run: getAllModelList } = useRequest(
		() =>
			PlatformPackageApi.getAllModelList({
				is_model_id_filter: true,
				status: 1,
			}),
		{
			manual: true,
			onSuccess: (res) => {
				setAllModelList([
					{
						id: PlatformPackage.ModelType.Dynamic,
						model_id: "",
						name: t("dynamicModel"),
						icon: dynamicModelIcon,
						description: t("dynamicModelDesc"),
					} as AiManage.ModelInfo,
					...res,
				])
			},
		},
	)

	const updateParams = useMemoizedFn((partial: Partial<PlatformPackage.ModeListParams>) => {
		const next: PlatformPackage.ModeListParams = {
			...params,
			...partial,
			page: 1,
		}
		setParams(next)
		run(next)
	})

	const { run: debouncedSearch } = useDebounceFn(
		(value: Partial<PlatformPackage.ModeListParams>) => {
			updateParams(value)
		},
		{ wait: 500 },
	)

	useMount(() => {
		run(params)
		getAllModelList()
	})

	const statusOptions = useMemo(
		() => [
			{ label: tCommon("all"), value: "all" },
			{ label: t("enable"), value: "1" },
			{ label: t("disable"), value: "0" },
		],
		[t, tCommon],
	)

	const hasEditRight = useRights(PERMISSION_KEY_MAP.MODE_MANAGEMENT_EDIT)

	const onChange = async (status: boolean, item: PlatformPackage.Mode) => {
		const { id } = item
		openModal(WarningModal, {
			open: true,
			title: status ? t("enableTip") : t("disableTip"),
			content: status ? t("enableTipDesc") : t("disableTipDesc"),
			dangerLevel: DangerLevel.Warning,
			showDeleteText: false,
			okText: tCommon("button.confirm"),
			okButtonProps: {
				danger: false,
			},
			onOk: () => {
				updateStatus({
					id,
					status,
				}).then(() => {
					message.success(tCommon("message.updateSuccess"))
					setList((prevList) =>
						prevList.map((it) => (it.id === id ? { ...it, status } : it)),
					)
				})
			},
		})
	}

	const leftAction = useMemoizedFn((item: PlatformPackage.Mode) => {
		const { status } = item
		return (
			<Flex gap={8} align="center">
				<div className={styles.status}>{tCommon("status")}</div>
				<MagicSwitch
					disabled={item.is_default === 1}
					checked={status}
					onChange={(checked) => onChange(checked, item)}
				/>
			</Flex>
		)
	})

	// 分配模型
	const goToAssignMode = useMemoizedFn(
		(item?: PlatformPackage.Mode | null, onRefresh?: () => void) => {
			openModal(AssignModal, {
				info: item,
				allModelList,
				goToEdit: goToAssignMode,
				onOk: () => {
					onRefresh?.()
				},
			})
		},
	)

	const openAddModeModal = useMemoizedFn((info?: PlatformPackage.Mode | null) => {
		if (!hasEditRight) return
		openModal(AddModeModal, {
			info,
			onOk: (mode) => {
				setList((prevList) => {
					const index = prevList.findIndex((it) => it.id === mode.id)
					if (index !== -1) {
						const newList = [...prevList]
						newList[index] = mode
						return newList
					}
					return [...prevList, mode]
				})
			},
		})
	})

	const rightAction = useMemoizedFn((item: PlatformPackage.Mode) => {
		return (
			<Flex gap={10} align="center">
				<MagicButton
					type="link"
					className={styles.button}
					onClick={() => {
						goToAssignMode(item)
					}}
				>
					{t("assignModel")}
				</MagicButton>
				{!item.is_default && (
					<MagicButton
						type="link"
						className={styles.button}
						onClick={() => openAddModeModal(item)}
					>
						{t("edit")}
					</MagicButton>
				)}
			</Flex>
		)
	})

	const icon = useMemoizedFn((item: PlatformPackage.Mode) => {
		const { icon_type, icon_url } = item

		const opacity = icon_type === PlatformPackage.IconType.Image ? 1 : 0.1
		const bgColor = addAlphaToHex(item.color, opacity)
		return (
			<div className={styles.iconWrapper} style={{ backgroundColor: bgColor }}>
				{icon_type === PlatformPackage.IconType.Image && icon_url ? (
					<img src={icon_url} alt="icon" width={28} height={28} />
				) : (
					IconComponent(item.icon, 30, item.color)
				)}
			</div>
		)
	})

	const onScroll = useMemoizedFn((e: React.UIEvent<HTMLDivElement>) => {
		if (total === list.length || loading) return
		const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
		if (scrollTop + clientHeight >= scrollHeight) {
			const newParams = { ...params, page: params.page + 1 }
			setParams(newParams)
			run(newParams)
		}
	})

	return (
		<Flex gap={10} vertical className={styles.container}>
			<div className={styles.title}>{t("superMagic")}</div>
			<Flex align="center" gap={10}>
				<MagicSelect
					prefix={tCommon("status")}
					style={{ width: 120 }}
					defaultValue="all"
					onChange={(value) =>
						updateParams({ status: value !== "all" ? value : undefined })
					}
					options={statusOptions}
				/>
				<MagicInput
					style={{ width: 200 }}
					placeholder={tCommon("pleaseInputPlaceholder", { name: t("modeName") })}
					allowClear
					onChange={(e) => {
						debouncedSearch({ keyword: e.target.value })
					}}
				/>
				<MagicInput
					style={{ width: 200 }}
					placeholder={tCommon("pleaseInputPlaceholder", { name: t("modeId") })}
					allowClear
					onChange={(e) => {
						debouncedSearch({ identifier: e.target.value })
					}}
				/>
			</Flex>
			<MagicSpin spinning={loading && params.page === 1} className={styles.spin}>
				<div onScroll={onScroll} className={styles.listContainer}>
					{list?.map((item) => (
						<MagicCard
							key={item.id}
							title={item.name_i18n.zh_CN}
							avatar={icon(item)}
							className={styles.card}
							description={
								item.is_default ? (
									item.description
								) : (
									<Flex gap={4} align="center">
										<div className={styles.label}>{t("identifier")}</div>
										<div className={styles.identifier}>{item.identifier}</div>
									</Flex>
								)
							}
							is2LineClamp={false}
							rightAction={rightAction(item)}
							leftAction={leftAction(item)}
						/>
					))}
					{hasEditRight && (
						<AddModuleBox
							onAddClick={() => openAddModeModal()}
							hasEditRight={hasEditRight}
							text={t("addMode")}
							className={styles.addService}
						/>
					)}
				</div>
			</MagicSpin>
		</Flex>
	)
}

export default ModeManagementPage
