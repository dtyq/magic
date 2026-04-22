<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Design\Facade;

use App\Infrastructure\Core\AbstractAuthApi;

/**
 * Design 领域抽象 API.
 */
abstract class AbstractApi extends AbstractAuthApi
{
    protected function getGuardName(): string
    {
        return 'web';
    }
}
