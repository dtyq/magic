<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Api\ChatBot;

use Dtyq\EasyDingTalk\Kernel\Constants\Host;
use Dtyq\EasyDingTalk\OpenDev\Api\OpenDevApiAbstract;
use Dtyq\SdkBase\Kernel\Constant\RequestMethod;

/**
 * 机器人发送群聊消息.
 * @see https://open.dingtalk.com/document/orgapp/the-robot-sends-a-group-message
 */
class SendGroupMessageApi extends OpenDevApiAbstract
{
    public function getMethod(): RequestMethod
    {
        return RequestMethod::Post;
    }

    public function getUri(): string
    {
        return '/v1.0/robot/groupMessages/send';
    }

    public function getHost(): string
    {
        return Host::API_DING_TALK;
    }
}
