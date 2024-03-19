import { useMemo, useState } from "react"
import { Flex, Form, Input, message } from "antd"
import { useTranslation } from "react-i18next"
import { IconSearch } from "@tabler/icons-react"
import type { DefaultOptionType } from "antd/es/select"
import type { Lang, MagicModalProps } from "components"
import { MagicSelect, MultiLangSetting, MagicModal, LanguageType } from "components"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import type { AiModel } from "@/const/aiModel"
import useFormChangeDetection from "@/hooks/useFormChangeDetection"
import { useApis } from "@/apis"
import type { OpenableProps } from "@/hooks/useOpenModal"
import { useAdminStore } from "@/stores/admin"
import { useStyles } from "./styles"
import ConfigForm from "../ConfigForm"
import ServiceIcon from "../ServiceIcon"

interface AddModelContentProps extends OpenableProps<MagicModalProps> {
	category: AiModel.ServiceProviderCategory
	selectedStatus: AiModel.Status
}

export const AddServiceModal = ({
	category,
	selectedStatus,
	onOk,
	onCancel,
	onClose,
	...rest
}: AddModelContentProps) => {
	const { t } = useTranslation("admin/ai/model")
	const { t: tCommon } = useTranslation("admin/common")

	const { AIManageApi } = useApis()
	const { isOfficialOrg } = useAdminStore()

	const [open, setOpen] = useState(true)
	const [searchOpen, setSearchOpen] = useState(false)
	const [selected, setSelected] = useState<DefaultOptionType>()
	const [langConfig, setLangConfig] = useState<Lang>()
	const [options, setOptions] = useState<DefaultOptionType[]>([])

	const { run: getServiceProvider } = useRequest(
		() =>
			isOfficialOrg
				? AIManageApi.getServiceProvider(category)
				: AIManageApi.getServiceProviderNonOfficial(category),
		{
			manual: true,
			onSuccess: (response) => {
				setOptions(
					response?.map((item) => ({
						label: item.name,
						value: item.id,
						icon: item.icon,
						remark: item.remark,
						category: item.category,
						code: item.provider_code,
						name: item.name,
						type: item.provider_type,
					})),
				)
			},
		},
	)

	useMount(() => {
		getServiceProvider()
	})

	const { styles, cx } = useStyles({ open: searchOpen })

	const [form] = Form.useForm()

	const initialFormValues = useMemo(() => {
		return {
			service_provider_id: undefined,
			alias: "",
			config: {},
		}
	}, [])

	// 使用表单变更检测hook
	const { hasChanges, resetChangeDetection } = useFormChangeDetection({
		form,
		initialValues: initialFormValues,
	})

	const onInnerCancel = useMemoizedFn(() => {
		if (hasChanges) {
			MagicModal.confirm({
				centered: true,
				title: tCommon("confirmClose"),
				content: tCommon("unsavedChanges"),
				onOk: () => {
					form.resetFields()
					setSelected(undefined)
					setOpen(false)
					onClose?.()
				},
			})
		} else {
			setOpen(false)
			onClose?.()
		}
	})

	const { runAsync: save } = useRequest(
		(data) =>
			isOfficialOrg
				? AIManageApi.addServiceProvider(data)
				: AIManageApi.addServiceProviderNonOfficial(data),
		{
			debounceWait: 300,
			manual: true,
		},
	)

	const onInnerOk = async (e: React.MouseEvent<HTMLButtonElement>) => {
		try {
			const values = await form.validateFields()

			await save({
				...values,
				status: selectedStatus,
				translate: {
					alias: {
						zh_CN: values.alias,
						...langConfig,
					},
				},
			})
			message.success(tCommon("message.addSuccess"))
			onOk?.(e)
			setOpen(false)
			onClose?.()
		} catch (error) {
			// console.log(error)
		}
	}

	const afterClose = useMemoizedFn(() => {
		form.resetFields()
		setSelected(undefined)
		resetChangeDetection()
	})

	return (
		<MagicModal
			title={t("addServiceProvider")}
			width={600}
			open={open}
			okText={tCommon("button.save")}
			onCancel={onInnerCancel}
			onOk={onInnerOk}
			afterClose={afterClose}
			centered
			{...rest}
		>
			<Form
				className={styles.form}
				requiredMark={false}
				colon={false}
				form={form}
				initialValues={initialFormValues}
			>
				<Form.Item
					label={t("form.serviceProvider")}
					className={cx(styles.formItem, styles.required)}
				>
					<Flex gap={6} vertical className={styles.searchGroup}>
						{searchOpen && <IconSearch size={20} className={styles.searchIcon} />}
						<Form.Item
							noStyle
							rules={[{ required: true, message: "" }]}
							name="service_provider_id"
						>
							<MagicSelect
								showSearch
								options={options}
								className={styles.search}
								filterOption={(input, option) =>
									(option?.label ?? "")
										.toString()
										.toLowerCase()
										.includes(input.toLowerCase())
								}
								placeholder={
									searchOpen
										? t("form.searchServiceProvider")
										: t("form.serviceProviderPlaceholder")
								}
								onOpenChange={(visible) => {
									setSearchOpen(visible)
								}}
								optionRender={(option) => {
									return (
										<Flex gap={10} align="center">
											<Flex gap={4} align="center">
												<ServiceIcon
													code={option.data.code}
													size={18}
													type={option.data.type}
												/>
												<span>{option.label}</span>
											</Flex>
											<span className={styles.desc}>
												{option.data.remark}
											</span>
										</Flex>
									)
								}}
								labelRender={(option) => {
									const provider = options?.find(
										(item) => item.value === option.value,
									)
									return (
										<Flex gap={4} align="center">
											{provider && (
												<ServiceIcon
													code={provider.code}
													type={provider.type}
													size={18}
												/>
											)}
											<span>{option.label}</span>
										</Flex>
									)
								}}
								onChange={(value) => {
									const provider = options?.find((item) => item.value === value)
									setSelected(provider)
								}}
							/>
						</Form.Item>
						<div className={styles.desc}>{t("form.serviceProviderDesc")}</div>
					</Flex>
				</Form.Item>

				{/* 别名 */}
				<Form.Item label={t("form.alias")} className={styles.formItem}>
					<Flex gap={10}>
						<Form.Item name="alias" noStyle>
							<Input placeholder={t("form.aliasPlaceholder")} />
						</Form.Item>
						<MultiLangSetting
							onSave={setLangConfig}
							info={langConfig}
							supportLangs={[LanguageType.en_US]}
						/>
					</Flex>
				</Form.Item>

				{selected && (
					<ConfigForm
						category={category}
						code={selected.code}
						name={selected.name}
						descPosition="right"
					/>
				)}
			</Form>
		</MagicModal>
	)
}
