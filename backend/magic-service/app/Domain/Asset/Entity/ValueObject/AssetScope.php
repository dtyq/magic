<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Entity\ValueObject;

/**
 * 资产列表的查询范围。
 */
enum AssetScope: string
{
    /** 全部：自己创建的 + 别人分享给我的。 */
    case ALL = 'ALL';

    /** 个人：只看自己创建的（含自己建的素材组）。 */
    case PERSONAL = 'PERSONAL';

    /** 团队分享：只看通过 magic_resource_visibility 授权给我或我所属部门的。 */
    case TEAM = 'TEAM';

    /** 官方公开：只看官方组织里 user_id 为空的资产。 */
    case PUBLIC = 'PUBLIC';

    /**
     * 无法识别的值一律回落个人范围：宁可少给数据，也不能把别人的资产带出来。
     */
    public static function fromValue(mixed $value): self
    {
        return is_string($value) ? (self::tryFrom($value) ?? self::PERSONAL) : self::PERSONAL;
    }

    /**
     * 是否需要按可见性授权记录过滤：团队分享与全部依赖授权记录，个人与公开不依赖。
     */
    public function includesSharedAssets(): bool
    {
        return match ($this) {
            self::ALL, self::TEAM => true,
            self::PERSONAL, self::PUBLIC => false,
        };
    }
}
