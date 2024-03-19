import type { SVGProps } from "react"

// ChevronRight icon component
export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg width="18" height="18" viewBox="0 0 18 18" fill="none" {...props}>
			<path
				d="M6.75 4.5L11.25 9L6.75 13.5"
				stroke="rgba(28, 29, 35, 0.6)"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

ChevronRightIcon.displayName = "ChevronRightIcon"

// Check badge icon for main organization
export function CheckIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg width="12" height="12" viewBox="0 0 12 12" fill="none" {...props}>
			<path
				d="M10.611 5.9454C10.611 5.2824 11.0706 4.5324 10.8312 3.9564C10.5834 3.3588 9.7188 3.156 9.2688 2.706C8.8182 2.2554 8.616 1.3914 8.0184 1.1436C7.4418 0.9048 6.6918 1.3638 6.0294 1.3638C5.3664 1.3638 4.6164 0.9042 4.0404 1.1436C3.4422 1.3908 3.24 2.2548 2.7894 2.7054C2.3388 3.156 1.4748 3.3582 1.227 3.9558C0.9882 4.5324 1.4472 5.2824 1.4472 5.9448C1.4472 6.6078 0.9876 7.3578 1.227 7.9338C1.4748 8.5314 2.3394 8.7342 2.7894 9.1842C3.24 9.6348 3.4422 10.4988 4.0398 10.7466C4.6164 10.9854 5.3664 10.5264 6.0288 10.5264C6.6918 10.5264 7.4418 10.986 8.0178 10.7466C8.6154 10.4988 8.8182 9.6342 9.2682 9.1842C9.7188 8.7336 10.5828 8.5314 10.8306 7.9338C11.0706 7.3578 10.611 6.6078 10.611 5.9454Z"
				fill="#32C436"
			/>
			<path
				d="M5.604 8.0604C5.4174 8.0604 5.2386 7.9836 5.1102 7.8486L3.921 6.5982C3.6618 6.3252 3.6726 5.8938 3.9456 5.6346C4.2186 5.3754 4.65 5.3862 4.9092 5.6586L5.5902 6.375L7.0992 4.698C7.3512 4.4184 7.782 4.3956 8.0622 4.6476C8.3418 4.8996 8.3646 5.3304 8.1126 5.6106L6.1104 7.8354C6.04752 7.90526 5.97088 7.96137 5.88528 8.00019C5.79968 8.03902 5.70698 8.05972 5.613 8.061C5.61 8.0604 5.607 8.0604 5.604 8.0604Z"
				fill="white"
			/>
		</svg>
	)
}

CheckIcon.displayName = "CheckIcon"

// Connection icon for department links
export function ConnectionIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none" {...props}>
			<path
				d="M10.5 1C10.5 0.723858 10.2761 0.5 10 0.5C9.72386 0.5 9.5 0.723858 9.5 1H10.5ZM10 10H9.5V10.5H10V10ZM10 1H9.5V10H10H10.5V1H10ZM10 10V10.5H19V10V9.5H10V10Z"
				fill="rgba(28, 29, 35, 0.35)"
			/>
		</svg>
	)
}

ConnectionIcon.displayName = "ConnectionIcon"
