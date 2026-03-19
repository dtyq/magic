import type { DefaultOptionType } from "antd/es/select"
import type { Knowledge } from "@/types/knowledge"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import MagicSelect from "@dtyq/magic-flow/dist/common/BaseUI/Select"

interface UserKnowledgeSelectProps {
	value?: Knowledge.KnowledgeDatabaseItem
	onChange?: (value: Knowledge.KnowledgeDatabaseItem) => void
	options: DefaultOptionType[]
	onPopupScroll: (e: any) => void
}

export default function UserKnowledgeSelect({
	value,
	onChange,
	options,
	onPopupScroll,
}: UserKnowledgeSelectProps) {
	const { t } = useTranslation("flow")

	// 用户自建知识库（向量知识库）选择变化
	const handleChange = useMemoizedFn((knowledge_code: string) => {
		const targetOption = options.find((item) => item.knowledge_code === knowledge_code)
		if (targetOption) {
			onChange?.({
				business_id: "",
				name: targetOption.name,
				description: targetOption.description,
				knowledge_type: targetOption.knowledge_type,
				knowledge_code: targetOption.knowledge_code,
			})
		}
	})

	return (
		<MagicSelect
			fieldNames={{
				label: "name",
				value: "knowledge_code",
			}}
			options={options}
			value={value ? value.name : undefined}
			onChange={handleChange}
			placeholder={t("common.userKnowledgeDatabasePlaceholder")}
			onPopupScroll={onPopupScroll}
		/>
	)
}
