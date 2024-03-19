<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity\ValueObject;

use BackedEnum;
use InvalidArgumentException;

enum PlatformType: string
{
    case None = 'none';

    // 天书
    case Teamshare = 'teamshare';
    case Magic = 'magic';
    case DingTalk = 'ding_talk';
    case FeiShu = 'feishu';
    case WeCom = 'wecom';

    public static function getEnum(BackedEnum|string $value): static
    {
        if ($value instanceof BackedEnum) {
            $valueString = $value->value;
        } else {
            $valueString = $value;
        }

        return match ($valueString) {
            'DingTalk' => self::DingTalk,
            'Lark' => self::FeiShu,
            'wecom' => self::WeCom,
            default => throw new InvalidArgumentException("Invalid value: {$value}"),
        };
    }
}
