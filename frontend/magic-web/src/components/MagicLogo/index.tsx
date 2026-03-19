import logo from "@/assets/logos/main.svg"
import magicColorText from "@/assets/text/color-magic.svg"
import magicColorTextDark from "@/assets/text/color-magic-dark.svg"
import chinese from "@/assets/text/chinese.svg"
import chineseDark from "@/assets/text/chinese-dark.svg"

import AtLogo from "@/assets/logos/atLogo.svg"
import { Flex } from "antd"
import type { HTMLAttributes } from "react"
import { memo } from "react"
import { createStyles, cx, useThemeMode } from "antd-style"

import { IconMagicTextLogo } from "@/enhance/tabler/icons-react"
import { LogoType } from "./LogoType"

import magicLogoJson from "./magic-logo.json?raw"
import DotLottieReact from "@/components/other/DotLottieReact"

const url = URL.createObjectURL(new Blob([magicLogoJson], { type: "application/json" }))

interface LogoProps extends HTMLAttributes<HTMLImageElement> {
	type?: LogoType
	beta?: boolean
	size?: number
}

const useStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		beta: css`
			display: flex;
			height: 12px;
			padding: 0px 4px;
			align-items: center;
			border-radius: 8px;
			font-family: Inter;
			font-size: 8px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px;
			color: ${isDarkMode ? token.magicColorUsages.black : token.magicColorUsages.white};
			background: ${isDarkMode
				? token.magicColorScales.grey[4]
				: token.magicColorScales.grey[3]};
		`,
		blurBg: css`
			position: absolute;
			left: 40%;
			top: 4px;
			transform: translateX(-40%);
			filter: blur(10px);
			opacity: 0.5;
		`,
		wrapper: css`
			position: relative;
			width: 42px;
			height: 42px;
		`,
	}
})

const MagicLogo = memo(({ type = LogoType.MAIN, beta: isBeta, className, ...props }: LogoProps) => {
	const { appearance } = useThemeMode()

	const { styles } = useStyles()

	if (type === LogoType.ICON) {
		return (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				className={className}
			>
				<mask id="path-1-inside-1_43_73789" fill="white">
					<path
						fillRule="evenodd"
						clipRule="evenodd"
						d="M12.0185 6.49877C11.8936 5.89336 11.8976 5.09686 12.4836 4.4722C13.577 3.30657 14.5954 3.49187 15.0347 4.02935C15.3131 4.37004 15.6717 5.1915 14.9701 5.64452C14.7775 5.76895 14.5084 5.90006 14.2385 6.03158C13.8628 6.2146 13.4856 6.39842 13.3102 6.56617C18.1403 7.07529 21 10.4063 21 14.4395C21 18.8251 17.6189 20.9993 12 20.9993C6.3811 20.9993 3 18.8251 3 14.4395C3 10.054 6.3811 6.49876 12 6.49876C12.0062 6.49876 12.0123 6.49876 12.0185 6.49877Z"
					/>
				</mask>
				<path
					d="M12.4836 4.4722L11.0249 3.1039V3.1039L12.4836 4.4722ZM12.0185 6.49877L12.0157 8.49877L14.4737 8.5022L13.9772 6.09485L12.0185 6.49877ZM15.0347 4.02935L16.5832 2.76369L16.5832 2.76368L15.0347 4.02935ZM14.9701 5.64452L13.8852 3.96436L13.8852 3.96436L14.9701 5.64452ZM14.2385 6.03158L13.3624 4.23366L13.3624 4.23366L14.2385 6.03158ZM13.3102 6.56617L11.9279 5.1207L8.80939 8.10284L13.1005 8.55515L13.3102 6.56617ZM11.0249 3.1039C9.79176 4.41849 9.87744 6.01896 10.0597 6.90269L13.9772 6.09485C13.9637 6.02902 13.9562 5.97008 13.9538 5.92C13.9515 5.86994 13.9546 5.83749 13.9574 5.82054C13.96 5.805 13.9616 5.80649 13.9562 5.81792C13.9537 5.82332 13.9505 5.82892 13.9471 5.83398C13.9436 5.83909 13.9415 5.84128 13.9423 5.84049L11.0249 3.1039ZM16.5832 2.76368C15.9483 1.98687 14.9506 1.53864 13.8605 1.61729C12.7793 1.6953 11.8114 2.26546 11.0249 3.1039L13.9423 5.84049C14.2492 5.5133 14.3371 5.5933 14.1483 5.60692C13.9506 5.62119 13.6817 5.53434 13.4861 5.29501L16.5832 2.76368ZM16.0551 7.32468C17.1627 6.60948 17.4664 5.47438 17.3555 4.55516C17.2623 3.78268 16.8967 3.14719 16.5832 2.76369L13.4861 5.29501C13.4487 5.24925 13.4359 5.22367 13.4295 5.20993C13.4232 5.19658 13.3969 5.13894 13.3843 5.03446C13.3711 4.92476 13.3691 4.72057 13.4685 4.48146C13.5753 4.22441 13.747 4.0536 13.8852 3.96436L16.0551 7.32468ZM15.1145 7.82951C15.3455 7.71698 15.739 7.52881 16.0551 7.32468L13.8852 3.96436C13.816 4.00909 13.6713 4.08314 13.3624 4.23366L15.1145 7.82951ZM14.6924 8.01164C14.6194 8.08149 14.5702 8.11206 14.5813 8.10467C14.5865 8.10126 14.611 8.08571 14.6635 8.05683C14.7747 7.99561 14.9154 7.92651 15.1145 7.82951L13.3624 4.23366C13.1859 4.31967 12.9502 4.434 12.735 4.55238C12.5527 4.65271 12.2169 4.84439 11.9279 5.1207L14.6924 8.01164ZM13.1005 8.55515C16.9938 8.96553 19 11.5091 19 14.4395H23C23 9.30342 19.2867 5.18505 13.5198 4.57719L13.1005 8.55515ZM19 14.4395C19 16.0433 18.4226 17.0466 17.4542 17.7297C16.3789 18.4883 14.6002 18.9993 12 18.9993V22.9993C15.0187 22.9993 17.74 22.4233 19.76 20.9983C21.8868 19.498 23 17.2213 23 14.4395H19ZM12 18.9993C9.39977 18.9993 7.62106 18.4883 6.54578 17.7297C5.57736 17.0466 5 16.0433 5 14.4395H1C1 17.2213 2.11319 19.498 4.24004 20.9983C6.26004 22.4233 8.98133 22.9993 12 22.9993V18.9993ZM5 14.4395C5 12.7781 5.63153 11.3322 6.75377 10.2902C7.87868 9.2457 9.61836 8.49876 12 8.49876V4.49876C8.76274 4.49876 6.00243 5.52942 4.03206 7.35893C2.05902 9.19092 1 11.7154 1 14.4395H5ZM12 8.49876C12.005 8.49876 12.0102 8.49876 12.0157 8.49877L12.0213 4.49877C12.0144 4.49876 12.0073 4.49876 12 4.49876V8.49876Z"
					fill="currentColor"
					mask="url(#path-1-inside-1_43_73789)"
				/>
				<path
					d="M8.14282 11.9369C8.14282 11.5365 8.47176 11.2119 8.87752 11.2119C9.28328 11.2119 9.61221 11.5365 9.61221 11.9369V14.4745C9.61221 14.875 9.28328 15.1996 8.87752 15.1996C8.47176 15.1996 8.14282 14.875 8.14282 14.4745V11.9369Z"
					fill="currentColor"
				/>
				<path
					d="M14.7551 11.9369C14.7551 11.5365 15.0841 11.2119 15.4898 11.2119C15.8956 11.2119 16.2245 11.5365 16.2245 11.9369V14.4745C16.2245 14.875 15.8956 15.1996 15.4898 15.1996C15.0841 15.1996 14.7551 14.875 14.7551 14.4745V11.9369Z"
					fill="currentColor"
				/>
			</svg>
		)
	}

	if (type === LogoType.SEARCHING) {
		return (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="18"
				height="18"
				viewBox="0 0 18 18"
				fill="none"
			>
				<g clipPath="url(#clip0_8092_48818)">
					<path
						d="M8.07819 10.099L12.8273 16.985C13.1671 17.4778 13.9375 17.3959 14.2052 16.8605C14.5727 16.1258 15.084 15.2414 15.6456 14.6788C16.0416 14.282 16.6059 13.9017 17.1468 13.5855C17.7242 13.2479 17.6923 12.3353 17.0679 12.0955L8.95886 8.98028C8.27501 8.71757 7.66228 9.49591 8.07819 10.099Z"
						fill="url(#paint0_linear_8092_48818)"
					/>
					<path
						d="M4.43915 1.25556C4.61457 0.781511 5.28506 0.781511 5.46047 1.25556L5.99042 2.68772C6.04557 2.83676 6.16308 2.95427 6.31212 3.00942L7.74428 3.53937C8.21833 3.71479 8.21833 4.38528 7.74428 4.56069L6.31212 5.09064C6.16308 5.14579 6.04557 5.2633 5.99042 5.41234L5.46047 6.8445C5.28506 7.31855 4.61457 7.31855 4.43915 6.8445L3.9092 5.41234C3.85405 5.2633 3.73654 5.14579 3.5875 5.09064L2.15534 4.56069C1.68129 4.38528 1.68129 3.71479 2.15534 3.53937L3.5875 3.00942C3.73654 2.95427 3.85405 2.83676 3.9092 2.68772L4.43915 1.25556Z"
						fill="url(#paint1_linear_8092_48818)"
					/>
					<path
						d="M13.6304 3.00146C13.7791 2.59945 14.3477 2.59945 14.4965 3.00146L14.8628 3.99129C14.9095 4.11768 15.0092 4.21733 15.1356 4.2641L16.1254 4.63037C16.5274 4.77913 16.5274 5.34773 16.1254 5.49648L15.1356 5.86275C15.0092 5.90952 14.9095 6.00917 14.8628 6.13556L14.4965 7.12539C14.3477 7.5274 13.7791 7.5274 13.6304 7.12539L13.2641 6.13556C13.2173 6.00917 13.1177 5.90952 12.9913 5.86275L12.0015 5.49648C11.5994 5.34773 11.5994 4.77913 12.0015 4.63037L12.9913 4.2641C13.1177 4.21733 13.2173 4.11768 13.2641 3.99129L13.6304 3.00146Z"
						fill="url(#paint2_linear_8092_48818)"
					/>
					<path
						d="M3.73022 11.1016C3.87898 10.6995 4.44758 10.6995 4.59634 11.1016L4.96261 12.0914C5.00938 12.2178 5.10903 12.3174 5.23542 12.3642L6.22525 12.7305C6.62726 12.8792 6.62726 13.4478 6.22524 13.5966L5.23542 13.9629C5.10903 14.0096 5.00938 14.1093 4.96261 14.2357L4.59634 15.2255C4.44758 15.6275 3.87898 15.6275 3.73022 15.2255L3.36395 14.2357C3.31718 14.1093 3.21753 14.0096 3.09114 13.9629L2.10131 13.5966C1.6993 13.4478 1.6993 12.8792 2.10131 12.7305L3.09114 12.3642C3.21753 12.3174 3.31718 12.2178 3.36395 12.0914L3.73022 11.1016Z"
						fill="url(#paint3_linear_8092_48818)"
					/>
				</g>
				<defs>
					<linearGradient
						id="paint0_linear_8092_48818"
						x1="13.7823"
						y1="18.1246"
						x2="12.3313"
						y2="7.3593"
						gradientUnits="userSpaceOnUse"
					>
						<stop stopColor="#FFF73F" />
						<stop offset="1" stopColor="#FF5F5F" />
					</linearGradient>
					<linearGradient
						id="paint1_linear_8092_48818"
						x1="6.6918"
						y1="5.85606"
						x2="3.51283"
						y2="-0.169991"
						gradientUnits="userSpaceOnUse"
					>
						<stop stopColor="#00D8FF" />
						<stop offset="1" stopColor="#0046FF" />
					</linearGradient>
					<linearGradient
						id="paint2_linear_8092_48818"
						x1="17.2957"
						y1="5.06343"
						x2="10.8311"
						y2="5.06343"
						gradientUnits="userSpaceOnUse"
					>
						<stop stopColor="#FF3F43" />
						<stop offset="1" stopColor="#FF5FF2" />
					</linearGradient>
					<linearGradient
						id="paint3_linear_8092_48818"
						x1="7.39557"
						y1="13.1635"
						x2="0.930994"
						y2="13.1635"
						gradientUnits="userSpaceOnUse"
					>
						<stop stopColor="#FFF73F" />
						<stop offset="1" stopColor="#FF5F5F" />
					</linearGradient>
					<clipPath id="clip0_8092_48818">
						<rect width="18" height="18" fill="white" />
					</clipPath>
				</defs>
			</svg>
		)
	}

	if (type === LogoType.TEXT) {
		return (
			<Flex align="flex-start" gap={4}>
				<IconMagicTextLogo size={props?.size} style={props?.style} />
				{isBeta ? <span className={styles.beta}>BETA</span> : null}
			</Flex>
		)
	}

	if (type === LogoType.COLOR_TEXT) {
		// return <AnimationMagic />
		return (
			<img
				src={appearance === "dark" ? magicColorTextDark : magicColorText}
				alt={LogoType.COLOR_TEXT}
				{...props}
			/>
		)
	}

	if (type === LogoType.CHINESE) {
		return (
			<img
				src={appearance === "dark" ? chineseDark : chinese}
				alt={LogoType.CHINESE}
				{...props}
			/>
		)
	}

	if (type === LogoType.AT) {
		return (
			<div className={cx(styles.wrapper, className)}>
				<DotLottieReact src={url} loop autoplay />
				<img className={cx(styles.blurBg)} src={AtLogo} alt="atLogo" />
			</div>
		)
	}

	return <img src={logo} alt="logo" width="323" {...props} />
})

export default MagicLogo
