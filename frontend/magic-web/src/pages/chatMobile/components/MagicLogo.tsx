import { createStyles } from "antd-style"

const useStyles = createStyles(({ token }) => ({
	logoContainer: {
		borderRadius: "50%",
		background: "linear-gradient(135deg, #315CEC 0%, #7697F6 50%, #BBD2FF 100%)",
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
		position: "relative",
		overflow: "hidden",
	},
	logoInner: {
		borderRadius: "50%",
		background: "radial-gradient(circle, #FFF73F 0%, #FF5F5F 100%)",
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
	},
	logoSymbol: {
		background: "linear-gradient(45deg, #00D8FF 0%, #0046FF 100%)",
		borderRadius: token.magicColorScales?.xs || 2,
		transform: "rotate(45deg)",
	},
}))

interface MagicLogoProps {
	size?: number
	className?: string
}

function MagicLogo({ size = 24, className }: MagicLogoProps) {
	const { styles } = useStyles()

	const logoStyle = {
		width: size,
		height: size,
		borderRadius: "50%",
		background: "linear-gradient(135deg, #315CEC 0%, #7697F6 50%, #BBD2FF 100%)",
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
		position: "relative" as const,
		overflow: "hidden" as const,
	}

	const innerStyle = {
		width: size * 0.75,
		height: size * 0.75,
		borderRadius: "50%",
		background: "radial-gradient(circle, #FFF73F 0%, #FF5F5F 100%)",
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
	}

	const symbolStyle = {
		width: size * 0.5,
		height: size * 0.5,
		background: "linear-gradient(45deg, #00D8FF 0%, #0046FF 100%)",
		borderRadius: 2,
		transform: "rotate(45deg)",
	}

	return (
		<div className={className} style={logoStyle}>
			<div style={innerStyle}>
				<div style={symbolStyle} />
			</div>
		</div>
	)
}

export default MagicLogo
