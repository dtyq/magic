<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Sms\Enum;

enum SignEnum: string
{
    case DENG_TA = 'DengTa';

    public const array MAP = [
        self::DENG_TA->value => [
            LanguageEnum::ZH_CN->value => '灯塔引擎',
        ],
        '灯塔引擎' => [
            LanguageEnum::ZH_CN->value => '灯塔引擎',
        ],
    ];

    /**
     * 短信签名多语言适配.
     */
    public static function format(SignEnum $type, ?LanguageEnum $language, LanguageEnum $defaultLanguage = LanguageEnum::ZH_CN): string
    {
        return self::MAP[$type->value][$language?->value] ?? (self::MAP[$type->value][$defaultLanguage->value] ?? $type->value);
    }
}
