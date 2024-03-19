import type { MagicModalProps } from "components"
import { colorUsages, MagicButton, MagicInput, MagicModal, MagicSpin } from "components"
import { useMount, useRequest } from "ahooks"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useApis } from "@/apis"
import { IconCheck, IconSearch } from "@tabler/icons-react"
import type { AiManage } from "@/types/aiManage"
import { Flex, Empty } from "antd"
import { debounce } from "lodash-es"
import type { OpenableProps } from "@/hooks/useOpenModal"
import BaseModelItem from "../../../components/ModalList/components/BaseModelItem"
import { useStyles } from "./styles"

interface AddModelModalProps extends OpenableProps<Omit<MagicModalProps, "onOk">> {
	onOk?: (models: AiManage.ModelInfo[]) => void
	existingModelIds?: string[]
}

const AddModelModal = ({ onOk, existingModelIds, onClose }: AddModelModalProps) => {
	const { t } = useTranslation("admin/platform/manage")
	const [open, setOpen] = useState(true)
	const { styles, cx } = useStyles()

	const { PlatformPackageApi } = useApis()

	const [searchLoading, setSearchLoading] = useState(false)
	const [searchValue, setSearchValue] = useState<string>("")
	const [selectedModels, setSelectedModels] = useState<AiManage.ModelInfo[]>([])
	const [list, setList] = useState<AiManage.ModelInfo[]>([])

	const {
		data: modelList,
		run: getAllModelList,
		loading,
	} = useRequest(
		() =>
			PlatformPackageApi.getAllModelList({
				is_model_id_filter: true,
				status: 1,
			}),
		{
			manual: true,
			onSuccess: (res) => {
				setList(res.filter((item) => !existingModelIds?.includes(item.id)))
			},
		},
	)

	useMount(() => {
		getAllModelList()
	})

	const filteredList = useMemo(() => {
		return modelList?.filter((item) => !existingModelIds?.includes(item.id)) || []
	}, [modelList, existingModelIds])

	const debounceSearch = useMemo(
		() =>
			debounce((value: string) => {
				if (value) {
					setList(
						filteredList.filter(
							(item) =>
								item.name?.toLowerCase().includes(value.toLowerCase()) ||
								item.model_id?.toLowerCase().includes(value.toLowerCase()),
						),
					)
				} else {
					setList(filteredList)
				}
				setSearchLoading(false)
			}, 300),
		[filteredList],
	)

	const operateAllOrSelect = () => {
		if (searchValue && selectedModels.length > 0) {
			setSearchValue("")
			debounceSearch("")
			setSelectedModels((prev) => prev.filter((item) => !item.name?.includes(searchValue)))
		} else {
			if (selectedModels.length === list.length) {
				setSelectedModels([])
			}
			if (selectedModels.length === 0) {
				setSelectedModels(list)
			} else {
				setSelectedModels(list.filter((item) => !selectedModels.includes(item)))
			}
		}
	}

	const search = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearchLoading(true)
		setSearchValue(e.target.value)
		debounceSearch(e.target.value)
	}

	const onInnerCancel = () => {
		setOpen(false)
		onClose?.()
	}

	const onInnerOk = () => {
		onOk?.(selectedModels)
		setOpen(false)
		onClose?.()
	}

	return (
		<MagicModal
			centered
			width={600}
			open={open}
			loading={loading}
			onCancel={onInnerCancel}
			title={
				<Flex vertical gap={2}>
					<div className={styles.modalTitle}>{t("addModel")}</div>
					<div className={styles.modalDesc}>{t("addModelDesc")}</div>
				</Flex>
			}
			onOk={onInnerOk}
			afterClose={() => {
				setSelectedModels([])
			}}
			className={styles.modal}
			footer={(originNode) => {
				return (
					<Flex justify="space-between" gap={10} align="center">
						<MagicButton
							type="link"
							className={styles.allOrSelect}
							onClick={() => operateAllOrSelect()}
						>
							{t("allOrSelect")}
						</MagicButton>
						<Flex gap={10}>{originNode}</Flex>
					</Flex>
				)
			}}
		>
			<MagicInput
				prefix={<IconSearch size={16} color={colorUsages.text[3]} />}
				placeholder={t("searchModelId")}
				allowClear
				value={searchValue}
				onChange={search}
			/>
			{!searchLoading && list.length === 0 ? (
				<Empty className={styles.empty} />
			) : searchLoading ? (
				<Flex
					flex={1}
					vertical
					align="center"
					justify="center"
					style={{ width: "100%", height: "100%" }}
				>
					<MagicSpin />
				</Flex>
			) : (
				<Flex vertical gap={4} className={styles.list}>
					{list?.map((item) => (
						<BaseModelItem
							key={item.id}
							item={item}
							isLLM={false}
							showModelId
							showDescription={false}
							className={cx(
								styles.item,
								selectedModels.includes(item) && styles.selectedModelItem,
							)}
							onClick={() => {
								if (selectedModels.includes(item)) {
									setSelectedModels(
										selectedModels.filter((model) => model.id !== item.id),
									)
								} else {
									// 选择与当前模型标识相同的模型
									const newSelectedModels = list.filter(
										(model) => model.model_id === item.model_id,
									)

									setSelectedModels([...selectedModels, ...newSelectedModels])
								}
							}}
						>
							{selectedModels.includes(item) && (
								<IconCheck
									size={20}
									color="currentColor"
									style={{ flexShrink: 0 }}
								/>
							)}
						</BaseModelItem>
					))}
				</Flex>
			)}
		</MagicModal>
	)
}

export default AddModelModal
