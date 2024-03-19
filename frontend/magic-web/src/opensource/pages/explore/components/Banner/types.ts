export interface BannerData {
	title: string
	link: string
	desc: string
	img: string
}
export interface BannerProps {
	data: BannerData[]
	loading?: boolean
}
