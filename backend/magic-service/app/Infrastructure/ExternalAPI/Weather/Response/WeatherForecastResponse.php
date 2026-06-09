<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Weather\Response;

class WeatherForecastResponse
{
    public function __construct(
        private readonly array $data,
    ) {
    }

    public static function fromArray(array $data): self
    {
        return new self($data);
    }

    public function toArray(): array
    {
        return $this->data;
    }

    public function getLocation(): ?string
    {
        return $this->data['location'] ?? null;
    }

    public function getCurrent(): array
    {
        return $this->data['current'] ?? [];
    }

    public function getForecast(): array
    {
        return $this->data['forecast'] ?? [];
    }

    public function getAirQuality(): array
    {
        return $this->data['air_quality'] ?? [];
    }

    public function getAlerts(): array
    {
        return $this->data['alerts'] ?? [];
    }

    public function getAiSummary(): ?string
    {
        return $this->data['ai_summary'] ?? null;
    }
}
