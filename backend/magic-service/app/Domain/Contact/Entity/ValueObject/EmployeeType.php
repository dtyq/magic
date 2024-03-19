<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity\ValueObject;

/**
 * 员工类型.
 */
enum EmployeeType: int
{
    // 未知(比如是个人版用户)
    case Unknown = 0;

    // 正式员工
    case Formal = 1;

    // 实习生
    case Intern = 2;

    // 外包
    case Outsourcing = 3;

    // 劳务派遣
    case LaborDispatch = 4;

    // 顾问
    case Consultant = 5;
}
