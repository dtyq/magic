import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

const IconSuperMagic = memo(({ size = 20, color = "currentColor" }: IconProps) => {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 16 16"
			fill="none"
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M6.97222 5.70986C6.10565 4.59843 4.03396 2.43772 2.67971 2.68623C1.59147 4.01166 1.69223 8.75419 3.84856 9.76897C3.62285 10.8459 3.47238 11.1289 3.42536 11.1358C3.92245 11.8952 5.53332 13.3973 8 13.331C10.4667 13.3973 12.0775 11.8952 12.5746 11.1358C12.5276 11.1289 12.3772 10.8459 12.1514 9.76897C14.3078 8.75419 14.4085 4.01166 13.3203 2.68623C11.966 2.43772 9.89435 4.59843 9.02778 5.70986C8.75371 5.52761 8.2284 5.49586 8 5.50276C7.7716 5.49586 7.24629 5.52761 6.97222 5.70986Z"
				stroke={color}
				strokeLinecap="round"
				strokeWidth="1.5"
			/>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M4.0029 7.99157C4.0029 7.46154 4.13806 6.6665 5.45112 6.6665H10.5489C11.8619 6.6665 11.9971 7.46154 11.9971 7.99157C11.9971 8.06254 11.9977 8.14252 11.9984 8.22905C12.0035 8.8965 12.0115 9.2868 11.7654 9.59959C11.4178 10.0413 9.37099 10.218 8.92686 9.59959C8.57157 9.1049 8.16091 9.0254 8 9.04748C7.83909 9.0254 7.42843 9.1049 7.07314 9.59959C6.62901 10.218 4.58219 10.0413 4.23461 9.59959C3.98847 9.2868 3.99653 8.8965 4.00163 8.22905C4.00229 8.14252 4.0029 8.06254 4.0029 7.99157Z"
				stroke={color}
				strokeLinecap="round"
				strokeWidth="1.5"
			/>
		</svg>
	)
})

IconSuperMagic.displayName = "IconSuperMagic"
export default IconSuperMagic
