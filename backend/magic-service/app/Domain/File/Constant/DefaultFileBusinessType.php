<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Constant;

enum DefaultFileBusinessType: string
{
    case SERVICE_PROVIDER = 'service_provider';
    case FLOW = 'flow';
    case MAGIC = 'magic';
    case MODE = 'mode';
}
