<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Exception;

use UnexpectedValueException;

final class InvalidMagicAccountStatusException extends UnexpectedValueException
{
    public function __construct(string $magicId, int $status)
    {
        parent::__construct("账号 {$magicId} 的状态值 {$status} 不受支持。");
    }
}
