<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

enum AssetErrorCode: int
{
    #[ErrorMessage('asset.not_found')]
    case NOT_FOUND = 48000;

    #[ErrorMessage('asset.compliance_service_missing')]
    case COMPLIANCE_SERVICE_MISSING = 48001;

    #[ErrorMessage('asset.compliance_failed')]
    case COMPLIANCE_FAILED = 48002;

    #[ErrorMessage('asset.admin_denied')]
    case ADMIN_DENIED = 48004;

    #[ErrorMessage('asset.user_required')]
    case USER_REQUIRED = 48005;

    #[ErrorMessage('asset.provider_response_invalid')]
    case PROVIDER_RESPONSE_INVALID = 48006;

    /** @deprecated 合规审核已改为轮询并设置超时，此码不再抛出，保留仅为兼容历史契约 */
    #[ErrorMessage('asset.compliance_processing')]
    case COMPLIANCE_PROCESSING = 48007;

    #[ErrorMessage('asset.compliance_timeout')]
    case COMPLIANCE_TIMEOUT = 48010;

    #[ErrorMessage('asset.agreement_required')]
    case AGREEMENT_REQUIRED = 48008;

    #[ErrorMessage('asset.file_required')]
    case FILE_REQUIRED = 48009;

    #[ErrorMessage('asset.group_not_empty')]
    case GROUP_NOT_EMPTY = 48011;

    #[ErrorMessage('asset.delete_denied')]
    case DELETE_DENIED = 48012;

    #[ErrorMessage('asset.tag_not_found')]
    case TAG_NOT_FOUND = 48013;

    #[ErrorMessage('asset.tag_structure_invalid')]
    case TAG_STRUCTURE_INVALID = 48014;

    #[ErrorMessage('asset.tag_not_allowed')]
    case TAG_NOT_ALLOWED = 48015;

    #[ErrorMessage('asset.personal_asset_quota_exceeded')]
    case PERSONAL_ASSET_QUOTA_EXCEEDED = 48016;
}
