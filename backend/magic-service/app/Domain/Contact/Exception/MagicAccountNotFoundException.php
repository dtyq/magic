<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Exception;

use DomainException;

final class MagicAccountNotFoundException extends DomainException
{
    public function __construct(string $magicId)
    {
        parent::__construct("账号 {$magicId} 不存在或已删除。");
    }
}
