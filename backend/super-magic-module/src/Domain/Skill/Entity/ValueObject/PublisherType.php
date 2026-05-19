<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject;

use function Hyperf\Translation\__;

enum PublisherType: string
{
    /**
     * 用户.
     */
    case USER = 'USER';

    /**
     * 官方.
     */
    case OFFICIAL = 'OFFICIAL';

    /**
     * 认证创作者.
     */
    case VERIFIED_CREATOR = 'VERIFIED_CREATOR';

    /**
     * 合作伙伴.
     */
    case PARTNER = 'PARTNER';

    /**
     * 官方内置.
     */
    case OFFICIAL_BUILTIN = 'OFFICIAL_BUILTIN';

    public function getDescription(): string
    {
        return match ($this) {
            self::USER => __('skill.publisher_type_user'),
            self::OFFICIAL => __('skill.publisher_type_official'),
            self::VERIFIED_CREATOR => __('skill.publisher_type_verified_creator'),
            self::PARTNER => __('skill.publisher_type_partner'),
            self::OFFICIAL_BUILTIN => __('skill.publisher_type_official_builtin'),
        };
    }

    public function isUser(): bool
    {
        return $this === self::USER;
    }

    public function isOfficial(): bool
    {
        return $this === self::OFFICIAL;
    }

    public function isOfficialBuiltin(): bool
    {
        return $this === self::OFFICIAL_BUILTIN;
    }
}
