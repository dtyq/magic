<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Sms\Enum;

enum LanguageEnum: string
{
    case DEFAULT = 'default';

    /**
     * 简中.
     */
    case ZH_CN = 'zh_CN';

    /**
     * 美式英语.
     */
    case EN_US = 'en_US';

    /**
     * 印尼语.
     */
    case ID_ID = 'id_ID';

    /**
     * 获取全部多语言代码数组（简短格式，用于 i18n 数组）.
     */
    public static function getAllLanguageCodes(): array
    {
        return [LanguageEnum::DEFAULT->value, self::ZH_CN->value, self::EN_US->value];
    }
}
