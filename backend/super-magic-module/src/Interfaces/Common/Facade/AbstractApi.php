<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Common\Facade;

use App\Infrastructure\Core\Traits\MagicUserAuthorizationTrait;

abstract class AbstractApi
{
    use MagicUserAuthorizationTrait;
}
