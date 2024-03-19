<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Constant;

enum MagicAgentVersionStatus: int
{
    // 审批流状态
    case APPROVAL_PENDING = 1; // 待审批
    case APPROVAL_IN_PROGRESS = 2; // 审批中
    case APPROVAL_PASSED = 3; // 审批通过
    case APPROVAL_REJECTED = 4; // 已驳回

    // AI Agent发布 (企业)
    case ENTERPRISE_UNPUBLISHED = 5; // 未发布
    case ENTERPRISE_PUBLISHED = 6; // 已发布
    case ENTERPRISE_ENABLED = 7; // 启用
    case ENTERPRISE_DISABLED = 8; // 禁用

    // AI Agent发布 (平台)
    case APP_MARKET_UNLISTED = 9; // 未上架
    case APP_MARKET_REVIEW = 10; // 审核中
    case APP_MARKET_LISTED = 11; // 已上架
}
