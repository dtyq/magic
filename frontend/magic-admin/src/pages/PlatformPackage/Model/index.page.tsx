import { AiModel } from "@/const/aiModel"
import ServiceProviderList from "../components/ServiceProviderList"

function ModelPage() {
	return <ServiceProviderList category={AiModel.ServiceProviderCategory.LLM} />
}

export default ModelPage
