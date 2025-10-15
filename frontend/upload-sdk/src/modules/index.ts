import type {
	PlatformMultipartUploadOption,
	PlatformRequest,
	PlatformSimpleUploadOption,
} from "../types"
import { PlatformType } from "../types"
import type { OSS } from "../types/OSS"
import type { OBS } from "../types/OBS"
import type { Kodo } from "../types/Kodo"
import type { TOS } from "../types/TOS"
import type { Local } from "../types/Local"
import type { S3 } from "../types/S3"
import OSSUpload from "./OSS"
import OBSUpload from "./OBS"
import KodoUpload from "./Kodo"
import TOSUpload from "./TOS"
import LocalUpload from "./Local"
import S3Upload from "./S3"

const PlatformModules: Record<
	PlatformType,
	Record<
		string,
		| PlatformRequest<OSS.AuthParams, PlatformSimpleUploadOption>
		| PlatformRequest<OSS.STSAuthParams, PlatformMultipartUploadOption>
		| PlatformRequest<Kodo.AuthParams, PlatformSimpleUploadOption>
		| PlatformRequest<TOS.AuthParams, PlatformMultipartUploadOption>
		| PlatformRequest<TOS.STSAuthParams, PlatformMultipartUploadOption>
		| PlatformRequest<OBS.STSAuthParams, PlatformMultipartUploadOption>
		| PlatformRequest<OBS.AuthParams, PlatformMultipartUploadOption>
		| PlatformRequest<Local.AuthParams, PlatformSimpleUploadOption>
		| PlatformRequest<S3.AuthParams, PlatformSimpleUploadOption>
		| PlatformRequest<S3.STSAuthParams, PlatformMultipartUploadOption>
	>
> = {
	[PlatformType.OSS]: OSSUpload,
	[PlatformType.Kodo]: KodoUpload,
	[PlatformType.TOS]: TOSUpload,
	[PlatformType.OBS]: OBSUpload,
	[PlatformType.Local]: LocalUpload,
	[PlatformType.S3]: S3Upload,
}

export default PlatformModules
