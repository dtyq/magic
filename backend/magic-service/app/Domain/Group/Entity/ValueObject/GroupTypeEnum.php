<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Group\Entity\ValueObject;

enum GroupTypeEnum: int
{
    // 内部群
    case Internal = 1;

    // 内部培训群
    case InternalTraining = 2;

    // 内部会议群
    case InternalMeeting = 3;

    // 内部项目群
    case InternalProject = 4;

    // 内部工单群
    case InternalWorkOrder = 5;

    // 外部群
    case External = 6;
}
