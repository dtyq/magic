<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Authorization\Web;

use App\Infrastructure\Core\UnderlineObjectJsonSerializable;
use Qbhy\HyperfAuth\Authenticatable;

abstract class AbstractAuthorization extends UnderlineObjectJsonSerializable implements Authenticatable
{
}
