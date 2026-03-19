import { type Bot } from "@/types/bot"
import { Checkbox, Flex, Form } from "antd"
import { useMemo } from "react"
import { useStyles } from "./style"
import usePlatforms from "./usePlatforms"

type PlatformInfoProps = {
	data: Bot.ThirdPartyPlatform
	name: string | number
}

export default function PlatformInfo({ data, name }: PlatformInfoProps) {
	const { styles } = useStyles()

	const { thirdPartyAppMap } = usePlatforms()

	const ImageComp = useMemo(() => {
		return thirdPartyAppMap?.[data.type]?.image
	}, [data.type, thirdPartyAppMap])

	return (
		<Flex align="center">
			<Form.Item noStyle name={[name, "enabled"]} valuePropName="checked">
				<Checkbox className={styles.checkbox} />
			</Form.Item>
			<div className={styles.platformImage}>
				<ImageComp size={24} />
			</div>
			<span
				className={styles.platformTitle}
			>{`${thirdPartyAppMap?.[data.type]?.title}(${data?.identification})`}</span>
			<span className={styles.platformDesc}>{thirdPartyAppMap?.[data.type]?.desc}</span>
		</Flex>
	)
}
