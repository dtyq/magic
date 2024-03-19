import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconCircleCheckFilled } from "@tabler/icons-react"
import { useSearchItemCommonStyles } from "./styles"
import HighlightText from "../HighlightText"

function Todo() {
	const { styles } = useSearchItemCommonStyles()

	return (
		<div className={styles.item}>
			<div className={styles.icon}>
				<MagicIcon size={20} component={IconCircleCheckFilled} style={{ flex: "none" }} />
			</div>
			<div className={styles.wrapper}>
				<div className={styles.title}>
					<HighlightText text="大白测试部门" />
				</div>
				<div className={styles.desc}>
					<HighlightText text="优先级：普通" />
				</div>
				<div className={styles.desc}>
					<HighlightText text="执行人：小白" />
				</div>
				<div className={styles.desc}>
					<HighlightText text="截止时间：9月2日 09:00" />
				</div>
			</div>
		</div>
	)
}

export default Todo
