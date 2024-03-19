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
 * 下载机器人接收消息的文件内容.
 * @see https://open.dingtalk.com/document/orgapp/download-the-file-content-of-the-robot-receiving-message
 */
class DownloadFileApi extends OpenDevApiAbstract
{
    public function getHost(): string
    {
        return Host::API_DING_TALK;
    }

    public function getMethod(): RequestMethod
    {
        return RequestMethod::Post;
    }

    public function getUri(): string
    {
        return '/v1.0/robot/messageFiles/download';
    }
}
