<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity\ValueObject;

/**
 * id类型:user_id/open_id/union_id.
 */
enum UserIdType: string
{
    /**
     * 组织内唯一
     */
    case UserId = 'user_id';

    /**
     * 组织的某个应用下唯一
     */
    case OpenId = 'open_id';

    /**
     * 应用的创建组织下唯一(用于应用跨组织追踪用于).
     */
    case UnionId = 'union_id';

    public function getPrefix(): string
    {
        return match ($this) {
            self::UserId => 'usi',
            self::OpenId => 'opi',
            self::UnionId => 'uni',
        };
    }

    public static function getCaseFromPrefix(string $prefix): ?self
    {
        return match ($prefix) {
            'usi' => self::UserId,
            'opi' => self::OpenId,
            'uni' => self::UnionId,
            default => null
        };
    }
}
