<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Facade\Admin;

use App\Infrastructure\Core\AbstractAuthApi;

class AbstractSuperMagicAdminApi extends AbstractAuthApi
{
    protected function getGuardName(): string
    {
        return 'web';
    }
}
