<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Facade;

use App\Infrastructure\Core\AbstractAuthApi;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Qbhy\HyperfAuth\Authenticatable;

class AbstractSuperMagicApi extends AbstractAuthApi
{
    protected function getGuardName(): string
    {
        return 'web';
    }

    /**
     * 这里只是为了声明返回值的具体类型.
     * @return MagicUserAuthorization
     */
    protected function getAuthorization(): Authenticatable
    {
        /* @phpstan-ignore-next-line */
        return parent::getAuthorization();
    }
}
