<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core;

use App\Infrastructure\Core\Traits\MagicUserAuthorizationTrait;

abstract class AbstractMCP
{
    use MagicUserAuthorizationTrait;
}
