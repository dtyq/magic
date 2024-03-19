import { useState } from "react"
import { Tabs } from "antd"
import { useTranslation } from "react-i18next"
import type { ProjectImageDropdownProps, TabKey } from "./types"
import { UploadTab } from "./tabs/upload-tab"
import { LinkTab } from "./tabs/link-tab"
import { ProjectTab } from "./tabs/project-tab"
import { useStyles } from "./styles"
import { IconX } from "@tabler/icons-react"
import FlexBox from "@/opensource/components/base/FlexBox"
import { useIsMobile } from "@/opensource/hooks/use-mobile"

export function ProjectImageDropdown({
	editor,
	onClose,
	onInserted,
	projectId,
}: ProjectImageDropdownProps) {
	const { t } = useTranslation("tiptap")
	const { styles, cx } = useStyles()
	const [activeTab, setActiveTab] = useState<TabKey>("upload")
	const isMobile = useIsMobile()

	const handleSuccess = () => {
		onInserted?.()
		onClose()
	}

	const tabItems = [
		{
			key: "upload" as TabKey,
			label: t("projectImage.dropdown.tabs.upload"),
			children: <UploadTab editor={editor} projectId={projectId} onSuccess={handleSuccess} />,
		},
		{
			key: "link" as TabKey,
			label: t("projectImage.dropdown.tabs.link"),
			children: <LinkTab editor={editor} onSuccess={handleSuccess} />,
		},
		...(projectId
			? [
					{
						key: "project" as TabKey,
						label: t("projectImage.dropdown.tabs.project"),
						children: (
							<ProjectTab
								editor={editor}
								projectId={projectId}
								onSuccess={handleSuccess}
							/>
						),
					},
				]
			: []),
	]

	return (
		<div className={cx(styles.dropdownPanel, isMobile && styles.mobileDropdownPanel)}>
			<FlexBox className={styles.closeButton} justify="center" align="center">
				<IconX size={20} stroke={1.5} onClick={onClose} />
			</FlexBox>
			<Tabs
				activeKey={activeTab}
				onChange={(key) => setActiveTab(key as TabKey)}
				items={tabItems}
				className={styles.tabsContainer}
			/>
		</div>
	)
}

// Re-export types for convenience
export type { ProjectImageDropdownProps, ImageAttachment, TabKey } from "./types"
