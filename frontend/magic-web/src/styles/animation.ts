import { css } from "antd-style"

export default () => css`
	.heart {
		animation: breathe 6s ease-in-out infinite;
	}

	@keyframes breathe {
		0% {
			transform: scale(0.97);
		}
		50% {
			transform: scale(1.03);
		}
		100% {
			transform: scale(0.97);
		}
	}

	.typing {
		width: 15em;
		white-space: nowrap;
		border-right: 2px solid transparent;
		animation:
			typing 3.5s steps(15, end),
			blink-caret 0.75s step-end infinite;
		overflow: hidden;
	}

	/* 打印效果 */
	@keyframes typing {
		from {
			width: 0;
		}
		to {
			width: 10em;
		}
	}

	/* 光标闪啊闪 */
	@keyframes blink-caret {
		from,
		to {
			box-shadow: 1px 0 0 0 transparent;
		}
		50% {
			box-shadow: 1px 0 0 0;
		}
	}
`
