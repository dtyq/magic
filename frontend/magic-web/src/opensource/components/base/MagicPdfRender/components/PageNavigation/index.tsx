import { Space, Tooltip, InputNumber } from "antd"
import { useTranslation } from "react-i18next"
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import type { FC } from "react"

interface PageNavigationProps {
	pageNumber: number
	numPages: number
	goToPrevPage: () => void
	goToNextPage: () => void
	goToPage: (page: number | null) => void
	isCompactMode: boolean
	styles: any
}

function PageNavigation({
	pageNumber,
	numPages,
	goToPrevPage,
	goToNextPage,
	goToPage,
	isCompactMode,
	styles,
}: PageNavigationProps): JSX.Element {
	const { t } = useTranslation("component")

	return (
		<Space className={styles.buttonGroup}>
			<Tooltip title={t("magicPdfRender.toolbar.prevPage")}>
				<button className={styles.button} disabled={pageNumber <= 1} onClick={goToPrevPage}>
					<IconChevronLeft />
				</button>
			</Tooltip>
			{!isCompactMode && (
				<div className={styles.pageInfo}>
					<InputNumber
						className={styles.pageInput}
						min={1}
						max={numPages}
						value={pageNumber}
						onChange={goToPage}
						size="small"
					/>
					<span>/ {numPages}</span>
				</div>
			)}
			<Tooltip title={t("magicPdfRender.toolbar.nextPage")}>
				<button
					className={styles.button}
					disabled={pageNumber >= numPages}
					onClick={goToNextPage}
				>
					<IconChevronRight />
				</button>
			</Tooltip>
		</Space>
	)
}

export default PageNavigation as FC<PageNavigationProps>
