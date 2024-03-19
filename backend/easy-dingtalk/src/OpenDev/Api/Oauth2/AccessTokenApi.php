<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Api\Oauth2;

use Dtyq\EasyDingTalk\Kernel\Constants\Host;
use Dtyq\EasyDingTalk\OpenDev\Api\OpenDevApiAbstract;
use Dtyq\SdkBase\Kernel\Constant\RequestMethod;

/**
 * 获取企业内部应用的accessToken.
 * @see https://open.dingtalk.com/document/orgapp/obtain-the-access_token-of-an-internal-app
 */
class AccessTokenApi extends OpenDevApiAbstract
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
        return '/v1.0/oauth2/accessToken';
    }
}
