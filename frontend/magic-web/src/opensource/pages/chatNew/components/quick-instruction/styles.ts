import { InstructionGroupType } from "@/opensource/types/bot"
import { createStyles } from "antd-style"

export const useStyles = createStyles(
	(
		{ css, token, isDarkMode },
		{ position, isMobile = false }: { position: InstructionGroupType; isMobile: boolean },
	) => {
		const dialogPcBg = isDarkMode ? token.magicColorUsages.bg[1] : token.magicColorUsages.white

		return {
			[`actionWrapper${InstructionGroupType.DIALOG}`]: css`
				padding: 4px 12px;
				border-radius: 100px;
				background: ${isMobile ? token.magicColorScales.grey[0] : dialogPcBg};
				border: 1px solid ${token.magicColorUsages.border};
			`,
			[`actionWrapper${InstructionGroupType.TOOL}`]: css`
				background: transparent;
				border: none;
				padding: 4px 6px !important;
				border-radius: 8px;
				color: ${token.colorTextSecondary};
				font-size: 12px;
				font-weight: 400;
				line-height: 16px !important;
				height: ${token.controlHeight}px;

				&:hover {
					background: ${token.colorBgTextHover};
				}
			`,

			instructionSelector: css`
				overflow-x: auto;
				gap: ${position === InstructionGroupType.DIALOG ? 8 : 4}px;

				::-webkit-scrollbar {
					display: none;
				}
			`,
		}
	},
)
