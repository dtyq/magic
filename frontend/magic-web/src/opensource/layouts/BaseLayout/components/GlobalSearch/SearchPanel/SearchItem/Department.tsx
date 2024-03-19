import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconSitemap } from "@tabler/icons-react"
import type { GlobalSearch } from "@/opensource/types/search"
import { useSearchItemCommonStyles } from "./styles"
import HighlightText from "../HighlightText"

interface SearchItemDepartmentProps {
	item: GlobalSearch.DepartmentItem
}

function Department(props: SearchItemDepartmentProps) {
	const { item } = props

	const { styles } = useSearchItemCommonStyles()

	return (
		<div className={styles.item} style={{ alignItems: "center" }}>
			<div className={styles.icon} style={{ backgroundColor: "#315CEC" }}>
				<MagicIcon
					size={20}
					component={IconSitemap}
					style={{ flex: "none" }}
					color="#FFFFFF"
				/>
			</div>
			<div className={styles.wrapper}>
				<div className={styles.title}>
					<HighlightText text={item?.name} />
				</div>
			</div>
		</div>
	)
}

export default Department
