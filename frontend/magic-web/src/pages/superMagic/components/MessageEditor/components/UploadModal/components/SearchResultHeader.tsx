import { useTranslation } from "react-i18next"

import { useDirectoryStyles } from "../styles"

interface SearchResultHeaderProps {
	onExitSearch: () => void
	isMobile?: boolean
}

function SearchResultHeader({ onExitSearch, isMobile = false }: SearchResultHeaderProps) {
	const { t } = useTranslation("super")
	const { styles } = useDirectoryStyles({ isMobile })

	const returnSearchTitle = isMobile
		? t("selectPathModal.returnSearch")
		: `${t("selectPathModal.returnSearch")} (Esc)`

	return (
		<div className={styles.searchContainer}>
			<div className={styles.searchHeader}>
				<span className={styles.searchHeaderTitle}>
					{t("selectPathModal.searchResult")}
				</span>
				<div onClick={onExitSearch} className={styles.searchHeaderReturn}>
					{returnSearchTitle}
				</div>
			</div>
		</div>
	)
}

export default SearchResultHeader
