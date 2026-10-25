<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MagicBase\Exception;

use App\ErrorCode\MagicBaseErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;

class MagicBaseColumnAccessDeniedException extends BusinessException
{
    public function __construct()
    {
        parent::__construct('当前用户无字段读取权限', MagicBaseErrorCode::AccessDenied->value);
    }
}
