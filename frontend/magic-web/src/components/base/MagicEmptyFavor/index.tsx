import noDataSvg from "@/assets/favorite/noData.svg"
import { useTranslation } from "react-i18next"
import { useMagicEmptyFavorStyle } from "./useMagicEmptyFavor"

const NoDataSvgComp = () => {
	const { styles } = useMagicEmptyFavorStyle()
	return <img src={noDataSvg} className={styles.img} alt="" />
}
type Props = {
	text?: string
}
export default function MagicEmptyFavor({ text }: Props) {
	const { t } = useTranslation()
	const { styles } = useMagicEmptyFavorStyle()
	return (
		<div className={styles.noDataContainer}>
			<NoDataSvgComp />
			<div>{text ?? t("favorite.noFavorite", { ns: "interface" })}</div>
		</div>
	)
}
