import { useCallback, useState, useEffect } from "react"
import { InputNumber, Space, Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import type { FC } from "react"

// Types
import type { NavigationProps } from "../../types"

function NavigationControls({
	currentSection,
	totalSections,
	goToPrevSection,
	goToNextSection,
	goToSection,
	isCompactMode,
	styles,
}: NavigationProps): JSX.Element {
	const { t } = useTranslation("component")
	const [inputValue, setInputValue] = useState<number>(currentSection)

	// Handle input change
	const handleInputChange = useCallback((value: number | null) => {
		if (value !== null) {
			setInputValue(value)
		}
	}, [])

	// Handle input enter or blur
	const handleInputSubmit = useCallback(() => {
		if (inputValue !== currentSection) {
			goToSection(inputValue)
		}
	}, [inputValue, currentSection, goToSection])

	// Update input value when current section changes
	useEffect(() => {
		setInputValue(currentSection)
	}, [currentSection])

	if (isCompactMode) {
		return (
			<Space className={styles.navigationCompact}>
				<Tooltip title={t("magicDocxRender.navigation.prevSection")}>
					<button
						className={styles.button}
						onClick={goToPrevSection}
						disabled={currentSection <= 1}
					>
						<IconChevronLeft />
					</button>
				</Tooltip>
				<Tooltip title={t("magicDocxRender.navigation.nextSection")}>
					<button
						className={styles.button}
						onClick={goToNextSection}
						disabled={currentSection >= totalSections}
					>
						<IconChevronRight />
					</button>
				</Tooltip>
			</Space>
		)
	}

	return (
		<Space className={styles.navigationFull}>
			<Tooltip title={t("magicDocxRender.navigation.prevSection")}>
				<button
					className={styles.button}
					onClick={goToPrevSection}
					disabled={currentSection <= 1}
				>
					<IconChevronLeft />
				</button>
			</Tooltip>

			<div className={styles.sectionInput}>
				<InputNumber
					size="small"
					min={1}
					max={totalSections}
					value={inputValue}
					onChange={handleInputChange}
					onPressEnter={handleInputSubmit}
					onBlur={handleInputSubmit}
					controls={false}
					style={{ width: 40 }}
				/>
				<span className={styles.sectionTotal}>/ {totalSections}</span>
			</div>

			<Tooltip title={t("magicDocxRender.navigation.nextSection")}>
				<button
					className={styles.button}
					onClick={goToNextSection}
					disabled={currentSection >= totalSections}
				>
					<IconChevronRight />
				</button>
			</Tooltip>
		</Space>
	)
}

export default NavigationControls as FC<NavigationProps>
