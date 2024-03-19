import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconXMindFile({ size }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size}>
			<g clipPath="url(#a)">
				<path
					fill="url(#b)"
					d="M15.763 0 23 7.237V22a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h12.763Z"
					clipRule="evenodd"
					fillRule="evenodd"
				/>
				<path
					fillOpacity=".401"
					fill="#fff"
					d="M17.763 7.237a2 2 0 0 1-2-2V0L23 7.237h-5.237Z"
					clipRule="evenodd"
					fillRule="evenodd"
				/>
				<path
					fill="url(#c)"
					d="M6.767 11.364c3.782.468 6.481 3.927 6.04 7.737 0 .013 0 .028-.002.04 0 .012 0 .022-.006.034a7.08 7.08 0 0 1-.468 1.789 6.862 6.862 0 0 1-3.87-1.814 7.177 7.177 0 0 0 .45-1.759 7.014 7.014 0 0 0-2.164-5.964c.005-.02.014-.039.023-.06l-.003-.003Z"
				/>
				<path
					fill="url(#d)"
					d="M17.194 16.6c-4.322-.468-7.407-3.927-6.904-7.737 0-.013 0-.028.004-.04 0-.013 0-.022.007-.034.09-.63.274-1.23.534-1.789 1.72.187 3.244.844 4.423 1.814a6.42 6.42 0 0 0-.513 1.759c-.07.495-.076.984-.028 1.461.174 1.75 1.093 3.346 2.501 4.502-.006.021-.017.04-.027.061l.003.003Z"
				/>
				<path
					fill="#fff"
					d="M16.784 16.545c-4.068-.472-6.97-3.959-6.497-7.8.904 1.49 2.374 2.652 4.166 3.2a7.982 7.982 0 0 0 3.565.246 6.7 6.7 0 0 1 .892 4.283c0 .012 0 .021-.007.034a7.948 7.948 0 0 1-2.118.04v-.003Z"
				/>
				<path
					fill="#fff"
					d="M6.962 11.42c3.661.471 6.273 3.957 5.847 7.798-.814-1.488-2.136-2.65-3.75-3.2a6.327 6.327 0 0 0-1.26-.292 6.56 6.56 0 0 0-1.175-.043 7.16 7.16 0 0 0-.773.089 7.318 7.318 0 0 1-.802-4.282c0-.012 0-.021.006-.034a6.423 6.423 0 0 1 1.907-.04v.003Z"
				/>
			</g>
			<defs>
				<linearGradient
					gradientUnits="userSpaceOnUse"
					y2="19.645"
					x2="1.932"
					y1="-1.051"
					x1="23.345"
					id="b"
				>
					<stop stopColor="#E9913E" offset=".01" />
					<stop stopColor="#F20000" offset="1" />
				</linearGradient>
				<linearGradient
					gradientUnits="userSpaceOnUse"
					y2="13.098"
					x2="11.236"
					y1="21.496"
					x1="6.727"
					id="c"
				>
					<stop stopColor="#fff" offset=".19" />
					<stop stopOpacity=".99" stopColor="#FDFCFC" offset=".4" />
					<stop stopOpacity=".97" stopColor="#F9F4F5" offset=".51" />
					<stop stopOpacity=".93" stopColor="#F3E7E9" offset=".6" />
					<stop stopOpacity=".88" stopColor="#E9D4D7" offset=".67" />
					<stop stopOpacity=".81" stopColor="#DDBBC0" offset=".74" />
					<stop stopOpacity=".73" stopColor="#CE9CA4" offset=".81" />
					<stop stopOpacity=".63" stopColor="#BC7883" offset=".87" />
					<stop stopOpacity=".51" stopColor="#A84E5C" offset=".92" />
					<stop stopOpacity=".38" stopColor="#911F31" offset=".97" />
					<stop stopOpacity=".3" stopColor="#830317" offset="1" />
				</linearGradient>
				<linearGradient
					gradientUnits="userSpaceOnUse"
					y2="18.666"
					x2="12.818"
					y1=".324"
					x1="18.957"
					id="d"
				>
					<stop stopColor="#fff" offset=".19" />
					<stop stopOpacity=".99" stopColor="#FDFCFC" offset=".4" />
					<stop stopOpacity=".97" stopColor="#F9F4F5" offset=".51" />
					<stop stopOpacity=".93" stopColor="#F3E7E9" offset=".6" />
					<stop stopOpacity=".88" stopColor="#E9D4D7" offset=".67" />
					<stop stopOpacity=".81" stopColor="#DDBBC0" offset=".74" />
					<stop stopOpacity=".73" stopColor="#CE9CA4" offset=".81" />
					<stop stopOpacity=".63" stopColor="#BC7883" offset=".87" />
					<stop stopOpacity=".51" stopColor="#A84E5C" offset=".92" />
					<stop stopOpacity=".38" stopColor="#911F31" offset=".97" />
					<stop stopOpacity=".3" stopColor="#830317" offset="1" />
				</linearGradient>
				<clipPath id="a">
					<path fill="#fff" d="M0 0h24v24H0z" />
				</clipPath>
			</defs>
		</svg>
	)
}

export default memo(IconXMindFile)
