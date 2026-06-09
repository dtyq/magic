<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Weather\Adapter;

use App\Infrastructure\ExternalAPI\Weather\Response\WeatherForecastResponse;

interface WeatherAdapterInterface
{
    /**
     * Query weather forecast for a given location.
     */
    public function forecast(string $location, int $days = 3, string $language = 'zh'): WeatherForecastResponse;

    /**
     * Get driver name.
     */
    public function getDriverName(): string;

    /**
     * Check if the driver is available (e.g., API key configured).
     */
    public function isAvailable(): bool;
}
