/**
 * 针对当前流程为草稿状态时的提示状态和行为
 */

import { Button, Flex } from "antd"
import { useMemoizedFn } from "ahooks"
import { Bounce, toast } from "react-toastify"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import styles from "../index.module.less"
import btnStyles from "../components/TestFlowButton/index.module.less"

export default function useDraftToast() {
	const { t } = useTranslation()
	const LoadTips = useMemo(() => {
		return (
			<Flex className={styles.toastContent} align="center" gap={8}>
				<Flex>
					<span>{t("common.isDraftTips", { ns: "flow" })}</span>
				</Flex>
				<Flex gap={6}>
					<Button
						type="text"
						size="small"
						className={btnStyles.btn}
						onClick={() => {
							toast.dismiss()
						}}
					>
						{t("common.IKnowIt", { ns: "flow" })}
					</Button>
				</Flex>
			</Flex>
		)
	}, [t])

	const showFlowIsDraftToast = useMemoizedFn(() => {
		toast.dismiss()
		toast.info(LoadTips, {
			position: "top-right",
			autoClose: 6000,
			hideProgressBar: false,
			closeOnClick: true,
			pauseOnHover: true,
			draggable: true,
			progress: undefined,
			theme: "light",
			transition: Bounce,
			className: styles.toast,
		})
	})

	return {
		showFlowIsDraftToast,
	}
}
