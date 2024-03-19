import { useMemoizedFn } from "ahooks"
import { createStyles } from "antd-style"
import type { OrganizationSelectItem } from "@/opensource/components/business/OrganizationPanel/originTypes"
import { useEffect, useState, type ReactNode } from "react"
import type { StructureUserItem } from "@/opensource/types/organization"
import { isMember } from "@/opensource/components/business/OrganizationPanel/utils"
import OrganizationPanel from "@/opensource/components/business/OrganizationPanel"
import { useContactPageDataContext } from "@/opensource/pages/contacts/components/ContactDataProvider/hooks"
import MagicNavBar from "@/opensource/components/base-mobile/MagicNavBar"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { last } from "lodash-es"
import OrganizationRender from "@/opensource/components/business/OrganizationRender"
import { navigateToUserDetail } from "../mobile/user-detail/utils"
import MagicSafeArea from "@/opensource/components/base/MagicSafeArea"
import { interfaceStore } from "@/opensource/stores/interface"

const useStyles = createStyles(({ css, token }) => {
	return {
		navBar: css``,
		scroll: css`
			height: calc(100% - 48px);
		`,
		organization: css`
			height: 100%;
			width: 100%;
			background-color: ${token.colorBgContainer};
		`,
		listItem: css`
			width: 100%;
		`,
		title: css`
			color: ${token.magicColorUsages.text[0]};
			text-align: center;
			font-size: 16px;
			font-style: normal;
			font-weight: 600;
			line-height: 22px;
		`,
	}
})

function OrganizationMobilePage() {
	const { styles, cx } = useStyles()
	const navigate = useNavigate()

	const { currentDepartmentPath, organizationCode } = useContactPageDataContext()
	const [departmentPath, setDepartmentPath] = useState<{ id: string; name: string }[]>([])

	useEffect(() => {
		setDepartmentPath(currentDepartmentPath)
	}, [currentDepartmentPath])

	const handleItemClick = useMemoizedFn((node: OrganizationSelectItem, toNext: () => void) => {
		if (!isMember(node)) {
			toNext()
		}
	})

	const memberNodeWrapper = useMemoizedFn((node: ReactNode, member: StructureUserItem) => {
		return (
			<div
				className={cx(styles.listItem)}
				onClick={() => {
					navigateToUserDetail(member.user_id, navigate)
				}}
			>
				{node}
			</div>
		)
	})

	useEffect(() => {
		return interfaceStore.setEnableGlobalSafeArea({
			// top: false,
			// bottom: false,
		})
	}, [])

	return (
		<>
			<MagicNavBar
				className={styles.navBar}
				onBack={() =>
					navigate({
						delta: -1,
						viewTransition: { type: "slide", direction: "right" },
					})
				}
			>
				<span className={styles.title}>
					{last(departmentPath)?.name ?? (
						<OrganizationRender organizationCode={organizationCode} />
					)}
				</span>
			</MagicNavBar>
			<div className={styles.scroll}>
				<OrganizationPanel
					className={styles.organization}
					defaultSelectedPath={currentDepartmentPath}
					selectedPath={departmentPath}
					onChangeSelectedPath={setDepartmentPath}
					onItemClick={handleItemClick}
					memberNodeWrapper={memberNodeWrapper}
				/>
			</div>
		</>
	)
}

export default OrganizationMobilePage
