import { cx } from "antd-style"
import { IconSelector } from "@tabler/icons-react"
import MagicSelect from "@dtyq/magic-flow/dist/common/BaseUI/Select"
import { Form } from "antd"
import styles from "./index.module.less"
import { LanguageOptions } from "./constants"
import { useCommercial } from "@/opensource/pages/flow/context/CommercialContext"
import { useMemo } from "react"
export default function LanguageSelect() {
	const extraData = useCommercial()

	const languages = useMemo(() => {
		if (extraData) {
			return LanguageOptions
		}
		return LanguageOptions.filter((item) => item.value !== "python")
	}, [extraData])

	return (
		<div className={styles.languageSelect}>
			<Form.Item name="language">
				<MagicSelect
					options={languages}
					className={cx("nodrag", styles.select)}
					suffixIcon={<IconSelector size={20} />}
				/>
			</Form.Item>
		</div>
	)
}
