<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

/**
 * 发布者类型枚举.
 */
enum PublisherType: string
{
    /**
     * 普通用户（C 端 User）.
     */
    case USER = 'USER';

    /**
     * 官方运营.
     */
    case OFFICIAL = 'OFFICIAL';

    /**
     * 认证创作者.
     */
    case VERIFIED_CREATOR = 'VERIFIED_CREATOR';

    /**
     * 第三方机构.
     */
    case PARTNER = 'PARTNER';

    /**
     * 获取发布者类型描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::USER => '普通用户',
            self::OFFICIAL => '官方运营',
            self::VERIFIED_CREATOR => '认证创作者',
            self::PARTNER => '第三方机构',
        };
    }

    /**
     * 是否为普通用户.
     */
    public function isUser(): bool
    {
        return $this === self::USER;
    }

    /**
     * 是否为官方运营.
     */
    public function isOfficial(): bool
    {
        return $this === self::OFFICIAL;
    }

    /**
     * 是否为认证创作者.
     */
    public function isVerifiedCreator(): bool
    {
        return $this === self::VERIFIED_CREATOR;
    }

    /**
     * 是否为第三方机构.
     */
    public function isPartner(): bool
    {
        return $this === self::PARTNER;
    }
}
