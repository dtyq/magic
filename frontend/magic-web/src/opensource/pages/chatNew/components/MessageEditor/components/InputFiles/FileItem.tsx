import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconX } from "@tabler/icons-react"
import { Flex } from "antd"
import { createStyles } from "antd-style"

import { darken, lighten } from "polished"
import FileIcon from "@/opensource/components/business/FileIcon"
import { formatFileSize } from "@/opensource/utils/string"
import type { FileData } from "./types"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"

const useFileItemStyles = createStyles(
	(
		{ css, isDarkMode, token },
		{
			status,
			progress,
			isMobile,
		}: { status: "init" | "uploading" | "done" | "error"; progress: number; isMobile: boolean },
	) => {
		const defaultBg = isDarkMode ? token.magicColorUsages.bg[2] : "white"

		// Improve color contrast for better visibility
		const loadedBg = isDarkMode
			? token.magicColorScales.green[6]
			: token.magicColorScales.green[1]

		// Ensure progress is within valid range (0-100)
		const safeProgress = Math.max(0, Math.min(100, progress || 0))

		// Use a more visible progress background with better contrast
		const progressBg =
			safeProgress > 0
				? `linear-gradient(to right, ${loadedBg} 0%, ${loadedBg} ${safeProgress}%, ${defaultBg} ${safeProgress}%, ${defaultBg} 100%)`
				: defaultBg

		const errorBg = isDarkMode
			? token.magicColorScales.red[8]
			: darken(0.02)(token.magicColorUsages.danger.default)

		const successBg = isDarkMode
			? token.magicColorScales.green[7]
			: token.magicColorScales.green[1]

		const bgMap = {
			init: defaultBg,
			uploading: progressBg,
			done: successBg,
			error: errorBg,
		}

		return {
			file: css`
				cursor: default;
				border-radius: 4px;
				background: ${bgMap[status]};
				padding: ${isMobile ? "4px" : "8px"};
				height: ${isMobile ? "28px" : "32px"};
				border: 1px solid ${token.colorBorder};
				color: ${token.magicColorUsages.text[1]};
				position: relative;
				overflow: hidden;
			`,
			name: css`
				color: ${token.magicColorUsages.text[1]};
				font-size: 12px;
				font-weight: 400;
				line-height: 16px;
				max-width: 120px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			`,
			size: css`
				color: ${token.magicColorUsages.text[3]};
				font-size: 12px;
				font-weight: 400;
				line-height: 16px;
				flex-shrink: 0;
			`,
			close: css`
				cursor: pointer;
				box-sizing: content-box;
				padding: 3px;
				background-color: ${token.magicColorUsages.danger.default};
				border-radius: 50%;
				color: ${token.magicColorUsages.white};
				&:hover {
					background-color: ${lighten(0.1, token.magicColorUsages.danger.default)};
				}
			`,
		}
	},
)
interface FileItemProps {
	data: FileData
	onRemove: (data: FileData) => void
}

export function FileItem({ data, onRemove }: FileItemProps) {
	const isMobile = useIsMobile()
	const { styles } = useFileItemStyles({ status: data.status, progress: data.progress, isMobile })

	const extension = data.name.split(".").pop() || ""

	return (
		<Flex className={styles.file} align="center" gap={isMobile ? 4 : 8} key={data.id}>
			<FileIcon ext={extension} />
			<span className={styles.name}>{data.name}</span>
			<span className={styles.size}>{formatFileSize(data.size ?? 0)}</span>
			<MagicIcon
				color="currentColor"
				component={IconX}
				className={styles.close}
				size={isMobile ? 6 : 12}
				stroke={4}
				onClick={() => onRemove?.(data)}
			/>
		</Flex>
	)
}
