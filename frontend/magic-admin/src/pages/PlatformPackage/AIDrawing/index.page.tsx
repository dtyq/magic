import { AiModel } from "@/const/aiModel"
import ServiceProviderList from "../components/ServiceProviderList"

function AIDrawingPage() {
	return <ServiceProviderList category={AiModel.ServiceProviderCategory.VLM} />
}

export default AIDrawingPage
