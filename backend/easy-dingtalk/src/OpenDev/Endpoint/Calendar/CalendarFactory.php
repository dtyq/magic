<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Endpoint\Calendar;

use Dtyq\EasyDingTalk\OpenDev\Result\Calendar\CreateEventResult;

class CalendarFactory
{
    public static function createCreateEventResult(array $rawData): CreateEventResult
    {
        return new CreateEventResult($rawData);
    }
}
