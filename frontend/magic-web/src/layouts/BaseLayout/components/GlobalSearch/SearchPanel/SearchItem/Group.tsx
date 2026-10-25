import type { GlobalSearch } from "@/types/search"
import { useTranslation } from "react-i18next"
import { searchItemClassNames as styles } from "./classNames"
import { cn as cx } from "@/utils/cn"
import HighlightText from "../HighlightText"

interface SearchItemGroupProps {
	item: GlobalSearch.GroupItem
}

function Group(props: SearchItemGroupProps) {
	const { item } = props

	const { t } = useTranslation("search")

	return (
		<div className={styles.item}>
			<div className={styles.icon}>
				<div
					className={styles.icon}
					style={{ backgroundImage: `url(${item?.group_avatar})` }}
				/>
			</div>
			<div className={styles.wrapper}>
				<div className={styles.title}>
					<HighlightText text={item?.group_name} />
				</div>
				<div className={cx(styles.desc, styles.text2)}>
					{t("quickSearch.label.member")}:{" "}
					{item?.users.map((user) => (
						<HighlightText key={user?.user_id} text={user?.nickname} />
					))}
				</div>
			</div>
		</div>
	)
}

export default Group
