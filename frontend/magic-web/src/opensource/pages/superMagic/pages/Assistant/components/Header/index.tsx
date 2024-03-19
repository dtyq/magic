import { IconOctahedron } from "@tabler/icons-react"
import { createStyles } from "antd-style"
import { useTranslation } from "react-i18next"
import FlexBox from "@/opensource/components/base/FlexBox"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import MagicButton from "@/opensource/components/base/MagicButton"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { RouteName } from "@/opensource/routes/constants"

const useStyles = createStyles(({ token, css }) => ({
	container: css`
		display: flex;
		align-items: center;
		padding: 0 6px;
	`,
	workspaceIcon: css`
		color: ${token.colorTextSecondary};
		flex-shrink: 0;
	`,
	breadcrumb: css`
		display: flex;
		align-items: center;
		color: ${token.colorText};
		font-size: 14px;
		font-weight: 500;
	`,
	separator: css`
		color: ${token.magicColorUsages.text[3]};
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
	`,
	workspaceText: css`
		color: ${token.magicColorUsages.text[1]};
		text-overflow: ellipsis;
		font-size: 14px;
		font-style: normal;
		font-weight: 400;
		line-height: 20px;
	`,
	button: css`
		color: ${token.colorText};
		border: none;
		gap: 4px;
		padding: 6px;
		overflow: hidden;
		color: ${token.magicColorUsages.text[1]};
		text-overflow: ellipsis;
		font-size: 14px;
		font-style: normal;
		font-weight: 400;
		line-height: 20px;
	`,
	dropdown: css`
		padding: 8px;
		background-color: ${token.colorBgContainer};
		border-radius: 8px;
		box-shadow: ${token.boxShadow};
	`,

	aiButton: css`
		cursor: default;
		&:hover {
			background-color: ${token.magicColorUsages.bg[1]} !important;
			color: ${token.magicColorUsages.text[1]} !important;
		}
	`,
}))

function Header() {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")
	const navigate = useNavigate()

	return (
		<FlexBox align="center" gap={6} className={styles.container}>
			<MagicButton
				className={styles.button}
				onClick={() => navigate({ name: RouteName.Super })}
			>
				<MagicIcon component={IconOctahedron} size={16} stroke={2} />
				<span className={styles.workspaceText}>{t("workspace.workspace")}</span>
			</MagicButton>
			<span className={styles.separator}>/</span>
			<MagicButton className={cx(styles.button, styles.aiButton)}>
				{t("assistant.aiChat")}
			</MagicButton>
			{/* <MagicDropdown
				trigger={["click"]}
				placement="bottomLeft"
				popupRender={() => {
					return (
						<div className={styles.dropdown}>
							<MagicButton
								className={styles.button}
								onClick={() => navigate(RoutePath.Super)}
							>
								{t("assistant.backToWorkspace")}
							</MagicButton>
						</div>
					)
				}}
			>
			
			</MagicDropdown> */}
		</FlexBox>
	)
}

export default Header
