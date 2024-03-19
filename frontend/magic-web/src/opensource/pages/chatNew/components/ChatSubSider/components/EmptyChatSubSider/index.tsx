import { Flex } from "antd"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import SubSiderContainer from "@/opensource/layouts/BaseLayout/components/SubSider"
import MagicSegmented from "@/opensource/components/base/MagicSegmented"
import MenuButton from "@/opensource/pages/user/pages/my/components/MenuButton"
import EmptyFallback from "../EmptyFallback"
import type { SegmentedKey } from "../../constants"
import useStyles from "../../style"

interface EmptyChatSubSiderProps {
	activeSegmentedKey: SegmentedKey
	options: Array<{ label: string; value: SegmentedKey }>
	handleSegmentedChange: (key: SegmentedKey) => void
	styles: ReturnType<typeof useStyles>["styles"]
}

function EmptyChatSubSider({
	activeSegmentedKey,
	options,
	handleSegmentedChange,
	styles,
}: EmptyChatSubSiderProps) {
	const { t } = useTranslation("interface")

	return (
		<SubSiderContainer className={styles.container}>
			<Flex align="center" gap={4} className={styles.segmentedContainer}>
				<MagicSegmented
					className={styles.segmented}
					value={activeSegmentedKey}
					options={options}
					block
					onChange={handleSegmentedChange}
				/>
				<MenuButton />
			</Flex>
			<Flex vertical gap={4} align="center" justify="center" className={styles.emptyFallback}>
				<EmptyFallback />
				<div className={styles.emptyFallbackText}>
					{t("chat.subSider.emptyFallbackText")}
				</div>
			</Flex>
		</SubSiderContainer>
	)
}

export default memo(EmptyChatSubSider)
