import { Empty, Flex } from "antd"
import { useTranslation } from "react-i18next"
import { MagicInput, colorUsages, MagicSpin } from "components"
import { IconSearch } from "@tabler/icons-react"
import { useState } from "react"
import { PlatformPackage } from "@/types/platformPackage"
import { useStyles } from "../../styles"
import DraggableModelItem from "../DraggableModelItem"
import { useModeConfigContext } from "../../hooks/useModeConfigContext"

const LeftWrapper = () => {
	const { t } = useTranslation("admin/platform/mode")
	const { styles } = useStyles()

	const { debouncedSearch, leftModelList: modelList, state } = useModeConfigContext()
	const { distributionMethod } = state

	const [searchLoading, setSearchLoading] = useState(false)

	return (
		<Flex vertical gap={10} className={styles.content} style={{ width: "40%" }}>
			<div className={styles.title}>{t("allModel")}</div>
			<span className={styles.desc}>{t("allModelDesc")}</span>
			<MagicInput
				allowClear
				placeholder={t("searchModel")}
				prefix={<IconSearch size={16} color={colorUsages.text[3]} />}
				onChange={(e) => {
					setSearchLoading(true)
					debouncedSearch(e.target.value, () => setSearchLoading(false))
				}}
			/>
			<MagicSpin spinning={searchLoading} className={styles.spin}>
				{modelList?.length === 0 && (
					<Flex justify="center" align="center" style={{ height: "100%" }}>
						<Empty description={t("noData")} />
					</Flex>
				)}
				<Flex vertical gap={4} className={styles.groupList}>
					{modelList?.map((model) => (
						<DraggableModelItem
							key={model.id}
							model={model}
							disableDrag={
								distributionMethod === PlatformPackage.DistributionType.Follow
							}
						/>
					))}
				</Flex>
			</MagicSpin>
		</Flex>
	)
}

export default LeftWrapper
