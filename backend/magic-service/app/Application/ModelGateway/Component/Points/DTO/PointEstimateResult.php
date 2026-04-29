<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Component\Points\DTO;

readonly class PointEstimateResult
{
    public function __construct(
        private string $resourceType,
        private int $points,
        private array $detail = [],
    ) {
    }

    public static function zero(string $resourceType): self
    {
        return new self($resourceType, 0);
    }

    public function getResourceType(): string
    {
        return $this->resourceType;
    }

    public function getPoints(): int
    {
        return $this->points;
    }

    public function getDetail(): array
    {
        return $this->detail;
    }

    public function toArray(): array
    {
        return [
            'resource_type' => $this->resourceType,
            'points' => $this->points,
            'detail' => $this->detail,
        ];
    }
}
