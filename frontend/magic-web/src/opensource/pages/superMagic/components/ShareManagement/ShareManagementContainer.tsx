import { observer } from "mobx-react-lite"
import ShareManagement from "./index"
import { globalShareManagementStore } from "./stores"

// 容器组件 - 应该被添加到应用的根组件中
const ShareManagementContainer = observer(function ShareManagementContainer() {
	return (
		<ShareManagement
			open={globalShareManagementStore.visible}
			onClose={globalShareManagementStore.close}
			projectId={globalShareManagementStore.projectId}
			defaultTab={globalShareManagementStore.defaultTab}
		/>
	)
})

export default ShareManagementContainer
