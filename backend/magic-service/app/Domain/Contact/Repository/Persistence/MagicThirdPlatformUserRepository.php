<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Persistence;

use App\Domain\Contact\Repository\Facade\MagicThirdPlatformUserRepositoryInterface;
use App\Domain\Contact\Repository\Persistence\Model\ThirdPlatformUserModel;

readonly class MagicThirdPlatformUserRepository implements MagicThirdPlatformUserRepositoryInterface
{
    public function __construct(
        protected ThirdPlatformUserModel $userModel,
    ) {
    }
}
