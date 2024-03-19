import { useBoolean, useMemoizedFn } from "ahooks"
import { cx } from "antd-style"
import { Button, Flex } from "antd"
import { useTranslation } from "react-i18next"
import useStyles from "./style"
import type { ResourceTypes } from "./types"
import AuthManagerModal from "./AuthManagerModal/index"

type AuthControlButtonProps = {
	Icon?: boolean
	resourceType: ResourceTypes
	resourceId: string
	className?: string
	disabled?: boolean
}

export default function AuthControlButton({
	Icon,
	resourceType,
	resourceId,
	className,
	disabled,
}: AuthControlButtonProps) {
	const { styles } = useStyles()

	const { t } = useTranslation()

	const [open, { setTrue, setFalse }] = useBoolean(false)

	const openModal = useMemoizedFn((e) => {
		e.stopPropagation()
		setTrue()
	})

	return (
		<>
			{!Icon && (
				<Button
					disabled={disabled}
					type="text"
					onClick={openModal}
					className={cx(styles.btn, className)}
				>
					{t("common.manageRights", { ns: "flow" })}
				</Button>
			)}
			{Icon && (
				<Flex flex={1} onClick={openModal}>
					{t("common.manageRights", { ns: "flow" })}
				</Flex>
			)}
			<AuthManagerModal
				open={open}
				extraConfig={{
					resourceType,
					resourceId,
				}}
				onClose={setFalse}
			/>
		</>
	)
}
