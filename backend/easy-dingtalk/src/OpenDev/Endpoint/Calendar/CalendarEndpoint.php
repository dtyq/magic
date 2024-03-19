<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Endpoint\Calendar;

use Dtyq\EasyDingTalk\Kernel\Exceptions\BadRequestException;
use Dtyq\EasyDingTalk\OpenDev\Api\Calendar\CreateEventApi;
use Dtyq\EasyDingTalk\OpenDev\Endpoint\OpenDevEndpoint;
use Dtyq\EasyDingTalk\OpenDev\Parameter\Calendar\CreateEventParameter;
use Dtyq\EasyDingTalk\OpenDev\Result\Calendar\CreateEventResult;
use GuzzleHttp\RequestOptions;

class CalendarEndpoint extends OpenDevEndpoint
{
    public function createEvent(CreateEventParameter $parameter): CreateEventResult
    {
        $parameter->validate();

        $api = new CreateEventApi();
        $api->setPathParams([
            'userId' => $parameter->getUserId(),
            'calendarId' => $parameter->getCalendarId(),
        ]);
        $api->setOptions([
            RequestOptions::HEADERS => [
                'x-acs-dingtalk-access-token' => $parameter->getAccessToken(),
                'x-client-token' => $parameter->getRequestId(),
            ],
            RequestOptions::JSON => $parameter->toBody(),
        ]);
        $response = $this->send($api);
        $data = json_decode($response->getBody()->getContents(), true);
        if (! is_array($data)) {
            throw new BadRequestException('Invalid response content');
        }
        return CalendarFactory::createCreateEventResult($data);
    }
}
