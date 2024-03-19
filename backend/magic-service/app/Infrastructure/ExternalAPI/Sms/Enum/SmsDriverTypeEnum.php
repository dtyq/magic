<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Sms\Enum;

enum SmsDriverTypeEnum: string
{
    // 火山短信
    case VOLCENGINE = 'volcengine';
}
