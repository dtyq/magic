<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject;

use App\Domain\Contact\Entity\ValueObject\PlatformType;

/**
 * 平台的根部门ID.
 */
class PlatformRootDepartmentId
{
    public const string Magic = '-1';

    public const string DingTalk = '1';

    public const string TeamShare = '0';

    public static function getRootDepartmentIdByPlatformType(PlatformType $thirdPlatformType): string
    {
        return match ($thirdPlatformType) {
            PlatformType::Magic => self::Magic,
            PlatformType::DingTalk => self::DingTalk,
            PlatformType::Teamshare => self::TeamShare,
            PlatformType::FeiShu => self::Magic,
            PlatformType::WeCom => self::Magic,
            PlatformType::None => self::Magic,
        };
    }
}
