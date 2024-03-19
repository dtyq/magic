<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace OpenDev\Provider\Calendar;

use DateTime;
use DateTimeZone;
use Dtyq\EasyDingTalk\OpenDev\Parameter\Calendar\CreateEventParameter;
use Dtyq\EasyDingTalk\Test\OpenDev\OpenDevEndpointBaseTestCase;

/**
 * @internal
 * @coversNothing
 */
class CalendarEndpointTestEndpoint extends OpenDevEndpointBaseTestCase
{
    public function testCreateEvent()
    {
        $openDev = $this->createOpenDevFactory('first');
        $param = new CreateEventParameter($openDev->accessTokenEndpoint->get());
        $param->setUserId('xxx');
        $param->setSummary('测试日程');
        $param->setStart(new DateTime('2024-09-02 10:00:00', new DateTimeZone('Asia/Shanghai')));
        $param->setEnd(new DateTime('2024-09-02 11:00:00', new DateTimeZone('Asia/Shanghai')));
        $param->setIsAllDay(false);
        $result = $openDev->calendarEndpoint->createEvent($param);
        $this->assertIsString($result->getId());
    }
}
