import { Suspense } from "react"
import { Outlet } from "react-router"
import { Flex } from "antd"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import ContactsSubSider from "../components/ContactsSubSider"
import ContactPageDataProvider from "../components/ContactDataProvider"
import { useStyles } from "./styles"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { useTranslation } from "react-i18next"
// import { ContactViewType } from "../constants"
// import { useContactPageDataContext } from "../components/ContactDataProvider/hooks"

// const TopBar = memo(() => {
// 	const { t } = useTranslation("interface")
// 	const { styles } = useStyles()
//
// 	const segmentedOptions = useMemo(() => {
// 		return [
// 			{
// 				label: t("contacts.topBar.segmented.list"),
// 				value: ContactViewType.LIST,
// 			},
// 			{
// 				label: t("contacts.topBar.segmented.architecturalView"),
// 				value: ContactViewType.TREE,
// 			},
// 		]
// 	}, [t])
//
// 	const { viewType, setViewType } = useContactPageDataContext()
//
// 	return (
// 		<Flex className={styles.topBar} align="center" justify="space-between">
// 			<span className={styles.title}>{t("contacts.topBar.title")}</span>
// 			<MagicSegmented
// 				options={segmentedOptions}
// 				className={styles.segmented}
// 				value={viewType}
// 				onChange={setViewType}
// 			/>
// 		</Flex>
// 	)
// })

function ContactsLayout() {
	const { styles } = useStyles()
	const isMobile = useIsMobile()
	const { t } = useTranslation("interface")

	if (isMobile) {
		return (
			<Suspense fallback={null}>
				<ContactPageDataProvider>
					<Outlet />
				</ContactPageDataProvider>
			</Suspense>
		)
	}

	return (
		<ContactPageDataProvider>
			<Flex vertical className={styles.container}>
				<div className={styles.header}>{t("contacts.topBar.title")}</div>
				{/* <TopBar /> */}
				<div className={styles.content}>
					<ContactsSubSider />
					<Flex flex={1}>
						<Suspense fallback={<MagicSpin />}>
							<Outlet />
						</Suspense>
					</Flex>
				</div>
			</Flex>
		</ContactPageDataProvider>
	)
}

export default ContactsLayout
