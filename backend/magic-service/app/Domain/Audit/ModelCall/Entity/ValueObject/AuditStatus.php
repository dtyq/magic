<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\ModelCall\Entity\ValueObject;

enum AuditStatus: string
{
    case SUCCESS = 'SUCCESS'; // 成功
    case FAIL = 'FAIL';       // 失败

    public function label(): string
    {
        return match ($this) {
            self::SUCCESS => '成功',
            self::FAIL => '失败',
        };
    }

    public function isSuccess(): bool
    {
        return $this === self::SUCCESS;
    }

    public function isFail(): bool
    {
        return $this === self::FAIL;
    }
}
