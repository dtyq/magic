import { Empty, type EmptyProps } from "antd"
import { useTranslation } from "react-i18next"

function MagicEmpty(props: EmptyProps) {
	const { t } = useTranslation("interface")

	return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noData")} {...props} />
}

export default MagicEmpty
