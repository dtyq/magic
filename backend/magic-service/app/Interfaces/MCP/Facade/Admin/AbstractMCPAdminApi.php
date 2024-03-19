<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\Facade\Admin;

use App\Infrastructure\Core\AbstractAuthApi;

class AbstractMCPAdminApi extends AbstractAuthApi
{
    protected function getGuardName(): string
    {
        return 'web';
    }
}
