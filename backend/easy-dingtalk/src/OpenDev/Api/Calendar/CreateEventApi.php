<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Api\Calendar;

use Dtyq\EasyDingTalk\Kernel\Constants\Host;
use Dtyq\EasyDingTalk\OpenDev\Api\OpenDevApiAbstract;
use Dtyq\SdkBase\Kernel\Constant\RequestMethod;

/**
 * @see https://open.dingtalk.com/document/orgapp/create-event
 */
class CreateEventApi extends OpenDevApiAbstract
{
    public function getMethod(): RequestMethod
    {
        return RequestMethod::Post;
    }

    public function getUri(): string
    {
        return '/v1.0/calendar/users/{userId}/calendars/{calendarId}/events';
    }

    public function getHost(): string
    {
        return Host::API_DING_TALK;
    }
}
