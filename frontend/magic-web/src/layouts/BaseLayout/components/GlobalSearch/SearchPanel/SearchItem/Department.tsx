import MagicIcon from "@/components/base/MagicIcon"
import { IconSitemap } from "@tabler/icons-react"
import type { GlobalSearch } from "@/types/search"
import { searchItemClassNames as styles } from "./classNames"
import HighlightText from "../HighlightText"

interface SearchItemDepartmentProps {
	item: GlobalSearch.DepartmentItem
}

function Department(props: SearchItemDepartmentProps) {
	const { item } = props

	return (
		<div className={`${styles.item} !items-center`}>
			<div className={`${styles.icon} !bg-[#315cec]`}>
				<MagicIcon
					size={20}
					component={IconSitemap}
					className="flex-none"
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
