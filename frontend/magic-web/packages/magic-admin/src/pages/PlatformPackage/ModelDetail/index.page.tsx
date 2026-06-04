import ServiceProviderDetail from "../components/ServiceProviderDetail"
import { useDetail } from "../hooks/useDetail"

function ModelDetailPage() {
	const { handleDataLoaded, reback } = useDetail("modelDetail")
	return <ServiceProviderDetail onDataLoaded={handleDataLoaded} reback={reback} />
}

export default ModelDetailPage
