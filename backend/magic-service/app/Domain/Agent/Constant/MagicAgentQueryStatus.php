<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Constant;

enum MagicAgentQueryStatus: int
{
    case UNPUBLISHED = 1; // 未发布
    case PUBLISHED = 2; // 已发布
    case ALL = 3; // 所有
}
