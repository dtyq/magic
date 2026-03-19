import { memo } from "react"
import { createStyles, cx } from "antd-style"

const useStyles = createStyles(({ css }) => {
	return {
		projectCardFolder: css`
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 10px;
			position: relative;

			@keyframes paperFloat {
				0% {
					transform: rotate(0deg) translateX(0px);
				}

				50% {
					transform: rotate(-10deg) translateX(-5px) translateY(-1px);
				}

				100% {
					transform: rotate(-8deg) translateX(-4px);
				}
			}

			@keyframes paperFloatReverse {
				0% {
					transform: rotate(-8deg) translateX(-4px);
				}

				50% {
					transform: rotate(-10deg) translateX(-5px) translateY(-1px);
				}

				100% {
					transform: rotate(0deg) translateX(0px);
				}
			}
		`,
		projectCardFolderHovered: css`
			#folder-path-card {
				animation: paperFloat 0.4s ease-out forwards;
			}
		`,
		projectCardFolderUnhovered: css`
			#folder-path-card {
				animation: paperFloatReverse 0.4s ease-out forwards;
			}
		`,
	}
})

interface IconWorkspaceProjectFolderProps {
	size?: number
	isHovered: boolean
	wasHovered?: boolean
}

export const IconWorkspaceProjectFolderIcon = memo(({ size = 60 }: { size?: number }) => {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 61 60"
			fill="none"
		>
			<path
				d="M16 9H50.5C54 9 55.75 10.75 55.75 14.25V42.75C55.75 46.25 54 48 50.5 48H16C12.5 48 10.75 46.25 10.75 42.75V14.25C10.75 10.75 12.5 9 16 9Z"
				fill="#FF9C55"
			/>
			<path
				d="M16.2898 14.8429L47.2905 10.6726C50.4355 10.2495 52.2198 11.6123 52.6434 14.7608L56.0923 40.3991C56.5159 43.5477 55.1551 45.3335 52.0101 45.7566L21.0094 49.9269C17.8644 50.35 16.0801 48.9872 15.6565 45.8387L12.2076 20.2004C11.784 17.0518 13.1448 15.266 16.2898 14.8429Z"
				fill="white"
				id="folder-path-card"
			/>
			<path
				d="M1.75 11.3333C1.75 9.91879 2.31189 8.56225 3.31207 7.56207C4.31225 6.56189 5.66878 6 7.08325 6H22.6675C23.826 6.00007 24.9529 6.37733 25.8779 7.07474C26.8029 7.77215 27.4757 8.75178 27.7945 9.8655L29.233 14.8883H53.4175C54.1179 14.8884 54.8115 15.0264 55.4585 15.2946C56.1056 15.5627 56.6935 15.9557 57.1887 16.4511C57.6839 16.9465 58.0766 17.5346 58.3445 18.1818C58.6124 18.829 58.7502 19.5226 58.75 20.223V48.6675C58.7498 50.0818 58.1878 51.4382 57.1876 52.4382C56.1875 53.4382 54.8311 54 53.4167 54H7.0825C5.66816 53.9998 4.31182 53.4378 3.31181 52.4377C2.31179 51.4375 1.75 50.0811 1.75 48.6668V11.3325V11.3333Z"
				fill="#FFD977"
			/>
			<path
				d="M9.25 39H13.75C14.75 39 15.25 39.5 15.25 40.5C15.25 41.5 14.75 42 13.75 42H9.25C8.25 42 7.75 41.5 7.75 40.5C7.75 39.5 8.25 39 9.25 39Z"
				fill="#FFF1C9"
			/>
			<path
				d="M9.25 45H19.75C20.75 45 21.25 45.5 21.25 46.5C21.25 47.5 20.75 48 19.75 48H9.25C8.25 48 7.75 47.5 7.75 46.5C7.75 45.5 8.25 45 9.25 45Z"
				fill="#FFF1C9"
			/>
			<path
				d="M10.75 28.5C12.75 28.5 13.75 29.5 13.75 31.5C13.75 33.5 12.75 34.5 10.75 34.5C8.75 34.5 7.75 33.5 7.75 31.5C7.75 29.5 8.75 28.5 10.75 28.5Z"
				fill="#FFA86A"
			/>
		</svg>
	)
})

const IconWorkspaceProjectFolder = memo(
	({ isHovered, wasHovered = false, size = 60 }: IconWorkspaceProjectFolderProps) => {
		const { styles } = useStyles()

		return (
			<div
				className={cx(
					styles.projectCardFolder,
					isHovered && styles.projectCardFolderHovered,
					!isHovered && wasHovered && styles.projectCardFolderUnhovered,
				)}
			>
				<IconWorkspaceProjectFolderIcon size={size} />
			</div>
		)
	},
)

IconWorkspaceProjectFolder.displayName = "IconWorkspaceProjectFolder"
export default IconWorkspaceProjectFolder
