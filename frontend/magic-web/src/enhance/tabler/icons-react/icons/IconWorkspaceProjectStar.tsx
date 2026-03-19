import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

const IconWorkspaceProjectStar = memo(({ size = 32 }: IconProps) => {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 32 32"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				opacity="0.5"
				d="M9.62101 8.15325C9.86293 8.39459 10.2684 8.16051 10.1803 7.83032L9.67116 5.92084C9.64045 5.80568 9.67336 5.68287 9.75753 5.59849L11.1532 4.19941C11.3946 3.95749 11.1605 3.55205 10.8303 3.64009L8.92082 4.14926C8.80565 4.17997 8.68285 4.14706 8.59847 4.06288L7.19939 2.66719C6.95746 2.42585 6.55203 2.65993 6.64007 2.99011L7.14924 4.8996C7.17994 5.01476 7.14704 5.13757 7.06286 5.22195L5.66717 6.62103C5.42583 6.86295 5.65991 7.26839 5.99009 7.18035L7.89958 6.67118C8.01474 6.64047 8.13755 6.67338 8.22193 6.75755L9.62101 8.15325Z"
				fill="url(#paint0_linear_31698_145853)"
			/>
			<path
				d="M13.0273 25.0631C13.0287 26.1561 14.4751 26.5437 15.0227 25.5977L18.1899 20.1274C18.3809 19.7975 18.7331 19.5942 19.1143 19.5937L25.4353 19.586C26.5283 19.5847 26.9159 18.1383 25.97 17.5906L20.4996 14.4235C20.1697 14.2325 19.9664 13.8803 19.9659 13.4991L19.9583 7.17806C19.9569 6.08504 18.5105 5.69747 17.9629 6.64339L14.7957 12.1137C14.6047 12.4436 14.2525 12.647 13.8713 12.6474L7.55028 12.6551C6.45727 12.6564 6.0697 14.1028 7.01561 14.6505L12.486 17.8176C12.8159 18.0087 13.0192 18.3608 13.0197 18.7421L13.0273 25.0631Z"
				fill="url(#paint1_linear_31698_145853)"
			/>
			<defs>
				<linearGradient
					id="paint0_linear_31698_145853"
					x1="4.0001"
					y1="4.22854"
					x2="9.59188"
					y2="1.00013"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#F2994A" />
					<stop offset="1" stopColor="#F2C94C" />
				</linearGradient>
				<linearGradient
					id="paint1_linear_31698_145853"
					x1="9.19099"
					y1="3.47348"
					x2="29.1399"
					y2="8.81877"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#F2994A" />
					<stop offset="1" stopColor="#F2C94C" />
				</linearGradient>
			</defs>
		</svg>
	)
})

IconWorkspaceProjectStar.displayName = "IconWorkspaceProjectStar"
export default IconWorkspaceProjectStar
