<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Constant;

enum MagicAgentReleaseStatus: int
{
    case PERSONAL_USE = 0; // 个人使用
    case PUBLISHED_TO_ENTERPRISE = 1; // 发布到企业
    case PUBLISHED_TO_MARKET = 2; // 发布到市场
}
