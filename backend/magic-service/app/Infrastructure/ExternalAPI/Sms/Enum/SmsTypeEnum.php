<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Sms\Enum;

enum SmsTypeEnum: string
{
    /*
     * 验证码,自定义有效期
     */
    case VERIFICATION_WITH_EXPIRATION = 'verification_with_expiration';

    public static function getDriverType(string $smsType, string $sign, string $phone): SmsDriverTypeEnum
    {
        return SmsDriverTypeEnum::VOLCENGINE;
    }
}
