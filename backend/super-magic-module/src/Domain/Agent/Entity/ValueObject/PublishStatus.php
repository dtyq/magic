<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

/**
 * 发布状态枚举.
 */
enum PublishStatus: string
{
    /**
     * 未发布（默认值，创建版本时即为未发布状态）.
     */
    case UNPUBLISHED = 'UNPUBLISHED';

    /**
     * 发布中.
     */
    case PUBLISHING = 'PUBLISHING';

    /**
     * 已发布.
     */
    case PUBLISHED = 'PUBLISHED';

    /**
     * 已下架.
     */
    case OFFLINE = 'OFFLINE';

    /**
     * 判断是否为未发布状态.
     */
    public function isUnpublished(): bool
    {
        return $this === self::UNPUBLISHED;
    }

    /**
     * 判断是否为发布中状态.
     */
    public function isPublishing(): bool
    {
        return $this === self::PUBLISHING;
    }

    /**
     * 判断是否为已发布状态.
     */
    public function isPublished(): bool
    {
        return $this === self::PUBLISHED;
    }

    /**
     * 判断是否为已下架状态.
     */
    public function isOffline(): bool
    {
        return $this === self::OFFLINE;
    }
}
