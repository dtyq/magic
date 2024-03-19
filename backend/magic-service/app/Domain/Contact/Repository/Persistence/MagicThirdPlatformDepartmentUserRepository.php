<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Persistence;

use App\Domain\Contact\Repository\Facade\MagicThirdPlatformDepartmentUserRepositoryInterface;
use App\Domain\Contact\Repository\Persistence\Model\ThirdPlatformDepartmentUserModel;

class MagicThirdPlatformDepartmentUserRepository implements MagicThirdPlatformDepartmentUserRepositoryInterface
{
    public function __construct(
        protected ThirdPlatformDepartmentUserModel $departmentUserModel,
    ) {
    }
}
