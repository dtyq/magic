import { clusterLoginAdapter } from "./cluster-login-adapter"
import { ClusterLayoutBase } from "./ClusterLayoutBase"

export default function ClusterLayout() {
	return <ClusterLayoutBase loginAdapter={clusterLoginAdapter} />
}
