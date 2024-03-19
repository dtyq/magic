<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Entity\Query;

use DateTime;
use Dtyq\TaskScheduler\Entity\ValueObject\TaskSchedulerStatus;

class TaskSchedulerQuery extends BaseQuery
{
    private array $ids = [];

    private array $externalIds = [];

    private ?DateTime $expectTimeLt = null;

    private ?TaskSchedulerStatus $status = null;

    public function getIds(): array
    {
        return $this->ids;
    }

    public function getExternalIds(): array
    {
        return $this->externalIds;
    }

    public function setExternalIds(array $externalIds): void
    {
        $this->externalIds = $externalIds;
    }

    public function setIds(array $ids): void
    {
        $this->ids = $ids;
    }

    public function getExpectTimeLt(): ?DateTime
    {
        return $this->expectTimeLt;
    }

    public function setExpectTimeLt(?DateTime $expectTimeLt): void
    {
        $this->expectTimeLt = $expectTimeLt;
    }

    public function getStatus(): ?TaskSchedulerStatus
    {
        return $this->status;
    }

    public function setStatus(?TaskSchedulerStatus $status): void
    {
        $this->status = $status;
    }
}
