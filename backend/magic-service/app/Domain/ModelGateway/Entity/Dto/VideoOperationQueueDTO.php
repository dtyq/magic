<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

use App\Infrastructure\Core\AbstractDTO;

class VideoOperationQueueDTO extends AbstractDTO
{
    protected ?int $position = null;

    protected int $sameUserAheadCount = 0;

    protected int $endpointTotalAheadCount = 0;

    protected int $runningCount = 0;

    public function getPosition(): ?int
    {
        return $this->position;
    }

    public function setPosition(?int $position): void
    {
        $this->position = $position;
    }

    public function getSameUserAheadCount(): int
    {
        return $this->sameUserAheadCount;
    }

    public function setSameUserAheadCount(int $sameUserAheadCount): void
    {
        $this->sameUserAheadCount = $sameUserAheadCount;
    }

    public function getEndpointTotalAheadCount(): int
    {
        return $this->endpointTotalAheadCount;
    }

    public function setEndpointTotalAheadCount(int $endpointTotalAheadCount): void
    {
        $this->endpointTotalAheadCount = $endpointTotalAheadCount;
    }

    public function getRunningCount(): int
    {
        return $this->runningCount;
    }

    public function setRunningCount(int $runningCount): void
    {
        $this->runningCount = $runningCount;
    }
}
