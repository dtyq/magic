<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Api\Conversation;

use Dtyq\EasyDingTalk\OpenDev\Api\OpenDevApiAbstract;
use Dtyq\SdkBase\Kernel\Constant\RequestMethod;

class CreateGroupApi extends OpenDevApiAbstract
{
    public function getUri(): string
    {
        return '/chat/create';
    }

    public function getMethod(): RequestMethod
    {
        return RequestMethod::Post;
    }
}
