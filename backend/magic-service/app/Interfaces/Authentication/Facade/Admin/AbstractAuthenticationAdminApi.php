<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Authentication\Facade\Admin;

use App\Infrastructure\Core\AbstractAuthApi;

abstract class AbstractAuthenticationAdminApi extends AbstractAuthApi
{
    protected function getGuardName(): string
    {
        return 'web';
    }
}
