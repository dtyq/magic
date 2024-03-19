import IconButton from "../../../ui/custom/IconButton/index"
import styles from "./index.module.css"
import { Download } from "../../../ui/icons/index"

export default function DownloadButton() {
	const handleDownload = () => {
		// console.log("下载")
	}

	return (
		<IconButton onClick={handleDownload} className={styles.downloadButton}>
			<Download size={16} />
		</IconButton>
	)
}
