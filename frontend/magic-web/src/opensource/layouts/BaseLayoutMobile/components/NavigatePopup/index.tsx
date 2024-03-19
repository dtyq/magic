import { observer } from "mobx-react-lite"
import MagicPopup from "@/opensource/components/base-mobile/MagicPopup"
import { mobileTabStore } from "@/opensource/stores/mobileTab"
import FlexBox from "@/opensource/components/base/FlexBox"
import { WorkspaceSection } from "@/opensource/pages/superMagicMobile/pages/navigate/components"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { useStyles } from "./styles"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconX } from "@tabler/icons-react"

function NavigatePopup() {
	const { styles } = useStyles()
	const { t } = useTranslation("super")

	const handleClose = useMemoizedFn(() => {
		mobileTabStore.closeNavigatePopup()
	})

	return (
		<MagicPopup
			visible={mobileTabStore.navigatePopupVisible}
			onClose={handleClose}
			onMaskClick={handleClose}
			position="bottom"
			bodyClassName={styles.popupBody}
			destroyOnClose={false}
			getContainer={() => document.body}
			stopPropagation={["click"]}
		>
			<div className={styles.header}>
				<div className={styles.title}>{t("mobile.navigate.title")}</div>
				<button className={styles.closeButton} onClick={handleClose}>
					<MagicIcon component={IconX} size={24} />
				</button>
			</div>
			<FlexBox vertical gap={20} className={styles.content}>
				<WorkspaceSection toWorkspace={handleClose} />
			</FlexBox>
		</MagicPopup>
	)
}

export default observer(NavigatePopup)
