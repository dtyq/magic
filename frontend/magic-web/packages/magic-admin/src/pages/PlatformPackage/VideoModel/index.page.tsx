import { AiModel } from "@admin/const/aiModel"
import ServiceProviderList from "../components/ServiceProviderList"

function VideoModelPage() {
	return <ServiceProviderList category={AiModel.ServiceProviderCategory.VGM} />
}

export default VideoModelPage
