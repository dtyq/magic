<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\Kernel\Contracts\Endpoint;

enum EndpointType: string
{
    case None = 'none';
    case OpenDev = 'open_dev';
}
