<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Api;

use Dtyq\EasyDingTalk\Kernel\Constants\Host;
use Dtyq\EasyDingTalk\Kernel\Contracts\ApiManager\ApiAbstract;

abstract class OpenDevApiAbstract extends ApiAbstract
{
    public function getHost(): string
    {
        return Host::OPEN_DING_TALK;
    }
}
