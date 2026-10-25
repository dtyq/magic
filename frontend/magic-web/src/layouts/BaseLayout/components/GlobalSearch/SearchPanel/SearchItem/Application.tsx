import type { GlobalSearch } from "@/types/search"
import { useMemoizedFn } from "ahooks"
import { useOrganization } from "@/models/user/hooks"
import HighlightText from "../HighlightText"
import { searchItemClassNames as styles } from "./classNames"
import { cn as cx } from "@/utils/cn"
import { useMagicSearchStore } from "../../store"

interface SearchItemApplicationProps {
	item: GlobalSearch.ApplicationItem
}

const applicationStyles = {
	item: "h-14",
	wrapper: "h-full justify-center",
}

function Application(props: SearchItemApplicationProps) {
	const { item } = props

	const closePanel = useMagicSearchStore((store) => store.closePanel)

	const { teamshareOrganizationCode } = useOrganization()

	const onClick = useMemoizedFn((event) => {
		event?.stopPropagation()
		window.open(`/application/${teamshareOrganizationCode}/${item?.code}?ddtab=true`)
		closePanel?.()
	})

	return (
		<div className={cx(styles.item, applicationStyles.item)} onClick={onClick}>
			<div className={styles.icon}>
				<div className={styles.icon} style={{ backgroundImage: `url(${item?.logo})` }} />
			</div>
			<div className={cx(styles.wrapper, applicationStyles.wrapper)}>
				<div className={styles.title}>
					<HighlightText text={item?.name} />
				</div>
				{item?.description && (
					<div className={cx(styles.desc, styles.text2)}>
						<HighlightText text={item?.description} />
					</div>
				)}
			</div>
		</div>
	)
}

export default Application
