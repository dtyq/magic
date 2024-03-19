import { MagicList } from "@/opensource/components/MagicList"
import { createStyles } from "antd-style"

const useStyles = createStyles(({ css }) => {
	return {
		list: css`
			width: 100%;
		`,
	}
})

function MyFriends() {
	const { styles } = useStyles()
	return <MagicList items={[]} className={styles.list} />
}

export default MyFriends
