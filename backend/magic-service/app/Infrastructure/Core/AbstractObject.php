<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core;

use DateTime;
use DateTimeZone;

abstract class AbstractObject extends BaseObject
{
    public function __construct(?array $data = null)
    {
        if (empty($data)) {
            return;
        }
        $this->initProperty($data);
    }

    protected function createDateTimeString(mixed $value): string
    {
        if (is_null($value)) {
            return '';
        }
        if (is_int($value)) {
            $value = date('Y-m-d H:i:s', $value);
        }
        if (is_array($value) && count($value) === 3 && isset($value['date'], $value['timezone_type'], $value['timezone'])) {
            $value = new DateTime($value['date'], new DateTimeZone($value['timezone']));
        }
        if ($value instanceof DateTime) {
            $value = $value->format('Y-m-d H:i:s');
        }
        return $value;
    }

    protected function createDatetime(mixed $value): ?DateTime
    {
        if ($value instanceof DateTime) {
            return $value;
        }
        if (is_null($value)) {
            return null;
        }
        if (is_int($value)) {
            $value = date('Y-m-d H:i:s', $value);
        }
        if (! is_array($value)) {
            $value = [$value];
        }
        if (count($value) === 3 && isset($value['date'], $value['timezone_type'], $value['timezone'])) {
            return new DateTime($value['date'], new DateTimeZone($value['timezone']));
        }

        return new DateTime(...$value);
    }
}
