import ServiceProviderDetail from "../components/ServiceProviderDetail"
import { useDetail } from "../hooks/useDetail"

function AIDrawingDetailPage() {
	const { handleDataLoaded, reback } = useDetail("drawingDetail")
	return <ServiceProviderDetail onDataLoaded={handleDataLoaded} reback={reback} />
}

export default AIDrawingDetailPage
