import { createStyles } from "antd-style"

const useSkeletonStyles = createStyles(({ token, css }) => ({
	skeleton: css`
		position: relative;
		overflow: hidden;
		background: ${token.colorFillQuaternary};

		&::after {
			content: "";
			position: absolute;
			inset: 0;
			transform: translateX(-100%);
			background: linear-gradient(
				90deg,
				rgba(255, 255, 255, 0) 0%,
				rgba(255, 255, 255, 0.35) 50%,
				rgba(255, 255, 255, 0) 100%
			);
			animation: shimmer 1.6s ease-in-out infinite;
		}

		@keyframes shimmer {
			100% {
				transform: translateX(100%);
			}
		}
	`,
}))

export default useSkeletonStyles
