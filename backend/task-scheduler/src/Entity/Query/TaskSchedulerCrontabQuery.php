<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Entity\Query;

use DateTime;

class TaskSchedulerCrontabQuery extends BaseQuery
{
    private ?DateTime $lastGenTimeGt = null;

    private ?bool $enable = null;

    private ?string $creator = null;

    private ?string $filterId = null;

    public function getEnable(): ?bool
    {
        return $this->enable;
    }

    public function setEnable(?bool $enable): void
    {
        $this->enable = $enable;
    }

    public function getLastGenTimeGt(): ?DateTime
    {
        return $this->lastGenTimeGt;
    }

    public function setLastGenTimeGt(?DateTime $lastGenTimeGt): void
    {
        $this->lastGenTimeGt = $lastGenTimeGt;
    }

    /**
     * Get the value of creator.
     */
    public function getCreator(): ?string
    {
        return $this->creator;
    }

    /**
     * Set the value of creator.
     */
    public function setCreator(?string $creator): self
    {
        $this->creator = $creator;

        return $this;
    }

    /**
     * Get the value of filterId.
     */
    public function getFilterId(): ?string
    {
        return $this->filterId;
    }

    /**
     * Set the value of filterId.
     */
    public function setFilterId(?string $filterId): self
    {
        $this->filterId = $filterId;

        return $this;
    }
}
