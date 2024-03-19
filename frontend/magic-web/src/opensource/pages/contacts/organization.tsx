import { useMemoizedFn } from "ahooks"
import { createStyles } from "antd-style"
import type { OrganizationSelectItem } from "@/opensource/components/business/OrganizationPanel/originTypes"
import { lazy, useMemo, type ReactNode } from "react"
import type { StructureUserItem } from "@/opensource/types/organization"
import MemberCardStore from "@/opensource/stores/display/MemberCardStore"
import { isMember } from "@/opensource/components/business/OrganizationPanel/utils"
import OrganizationPanel from "@/opensource/components/business/OrganizationPanel"
import { useContactPageDataContext } from "@/opensource/pages/contacts/components/ContactDataProvider/hooks"
import MagicButton from "@/opensource/components/base/MagicButton"
import IconMagicFile from "@/opensource/enhance/tabler/icons-react/icons/IconMagicFile"
import { useTranslation } from "react-i18next"
import { DriveItemFileType } from "@/opensource/types/drive"
import { getDriveFileRedirectUrl } from "@/opensource/utils/drive"
import { openNewTab } from "@/opensource/routes/helpers"
import { ContactApi } from "@/opensource/apis"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"

const useStyles = createStyles(({ css, token }) => {
	return {
		organization: css`
			height: 100%;
			min-height: 100%;
			padding: 10px 20px;
			width: 100%;
			flex: 1;
		`,
		listItem: css`
			width: 100%;
		`,
		button: css`
			height: 32px;
			font-size: 14px;
			border-radius: 8px;
			padding: 6px 10px;
			background-color: ${token.magicColorScales.orange[0]};
			color: ${token.magicColorUsages.text[1]};
		`,
		list: css`
			height: calc(100% - 50px);
		`,
	}
})

function OrganizationPage() {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("interface")

	const { currentDepartmentPath, setCurrentDepartmentPath } = useContactPageDataContext()

	const handleItemClick = useMemoizedFn(
		async (node: OrganizationSelectItem, toNext: () => void) => {
			if (!isMember(node)) {
				toNext()
			}
		},
	)

	const memberNodeWrapper = useMemoizedFn((node: ReactNode, member: StructureUserItem) => {
		return (
			<div
				data-user-id={member.user_id}
				className={cx(styles.listItem, MemberCardStore.domClassName)}
			>
				{node}
			</div>
		)
	})

	/**
	 * 检查部门说明书
	 */
	const handleCheckDoc = useMemoizedFn(async () => {
		const response = await ContactApi.getDepartmentDocument({
			department_id: currentDepartmentPath[currentDepartmentPath.length - 1].id,
		})
		if (typeof response === "string") {
			const path = getDriveFileRedirectUrl(response, DriveItemFileType.CLOUD_DOCX)
			const url = window.location.origin
			openNewTab(path, url)
		}
	})

	const breadcrumbRightNode = useMemo(() => {
		if (currentDepartmentPath.length <= 0) {
			return null
		}

		return (
			<MagicButton
				onClick={handleCheckDoc}
				type="text"
				icon={<IconMagicFile />}
				className={styles.button}
			>
				{t("organization.instruction")}
			</MagicButton>
		)
	}, [currentDepartmentPath.length, handleCheckDoc, styles.button, t])

	return (
		<OrganizationPanel
			className={styles.organization}
			selectedPath={currentDepartmentPath}
			onChangeSelectedPath={setCurrentDepartmentPath}
			onItemClick={handleItemClick}
			memberNodeWrapper={memberNodeWrapper}
			breadcrumbRightNode={breadcrumbRightNode}
			listClassName={styles.list}
		/>
	)
}

const OrganizationMobilePage = lazy(() => import("@/opensource/pages/contactsMobile/organization"))

export default () => {
	const isMobile = useIsMobile()
	return isMobile ? <OrganizationMobilePage /> : <OrganizationPage />
}
