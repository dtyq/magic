<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Notification\Entity\ValueObject;

use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;

/**
 * Notification 领域的数据隔离上下文。
 *
 * Notification 的 Repository 和 Application Service 必须显式接收该对象，
 * 不复用 Contact 领域的数据隔离实现，避免消息查询跨组织或跨用户。
 */
final class NotificationDataIsolation extends BaseDataIsolation
{
    public static function create(
        string $currentOrganizationCode = '',
        string $userId = '',
        string $magicId = ''
    ): self {
        return new self($currentOrganizationCode, $userId, $magicId);
    }
}
