<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Admin\Entity\ValueObject;

enum AgentFilterType: int
{
    case ALL = -1;  // 全部
    case SELECTED_DEFAULT_FRIEND = 1;  // 只展示设置为默认好友的列表
    case NOT_SELECTED_DEFAULT_FRIEND = 2;  // 只展示未被设置为默认好友的列表
}
