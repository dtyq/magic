<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\ExecutionData;

enum ExecutionOrigin: string
{
    case Magic = 'magic';
    case DingTalk = 'dingTalk';
}
