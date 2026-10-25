<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Agent\Exception;

use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;

use function Hyperf\Translation\trans;

class MagicClawRuntimeDeniedException extends BusinessException
{
    public function __construct()
    {
        parent::__construct(trans('permission.magic_claw_runtime_denied'), PermissionErrorCode::MAGIC_CLAW_RUNTIME_DENIED->value);
    }
}
