import { createStyles } from "antd-style"
import { darken } from "polished"

export const useStyles = createStyles(({ css, token, cx, prefixCls }) => {
	const text = cx(css`
		font-size: 14px;
		font-weight: 600;
		line-height: 20px;
		background: linear-gradient(
			95deg,
			#33d6c0 0%,
			#5083fb 25%,
			#336df4 50%,
			#4752e6 75%,
			#8d55ed 100%
		);

		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	`)

	return {
		button: css`
			gap: 2px;
			background: none;
			border-radius: 8px;
			background: ${token.colorBgContainer};
			padding: 0 12px;

			&:hover {
				background: ${darken(0.03, token.colorBgContainer)} !important;

				.${prefixCls}-btn-icon {
					transform-origin: 40% 40%;
					@keyframes rotate {
						0% {
							transform: rotate(0deg);
						}
						25% {
							transform: rotate(-20deg);
						}
						50% {
							transform: rotate(0);
						}
						75% {
							transform: rotate(-10deg);
						}
						100% {
							transform: rotate(0deg);
						}
					}

					animation: rotate 1s ease-in-out;
				}

				.${text} {
					@keyframes gradient {
						${Array.from({ length: 100 })
							.map(
								(_, index) => `
							${index + 1}% {
								background: linear-gradient(${95 + index * 3.6}deg, #33d6c0 0%, #5083fb 25%, #336df4 50%, #4752e6 75%, #8d55ed 100%);
								background-clip: text;
								-webkit-background-clip: text;
								-webkit-text-fill-color: transparent;
							}
						`,
							)
							.join("")}
					}
					animation: gradient 2s ease-in-out infinite;
				}
			}
		`,
		text,
		modalBody: css`
			width: 80vw;
			padding: 10px !important;
		`,
	}
})
