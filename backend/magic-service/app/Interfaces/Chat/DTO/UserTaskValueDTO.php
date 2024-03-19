<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\DTO;

use App\Infrastructure\Core\AbstractDTO;
use DateTime;

class UserTaskValueDTO extends AbstractDTO
{
    protected ?int $interval = 0;

    protected ?string $unit = '';

    protected ?string $month = '';

    protected ?array $values = [];

    protected ?DateTime $deadline = null;

    public function __construct(?array $data = null)
    {
        parent::__construct($data);
    }

    /**
     * Get the value of interval.
     */
    public function getInterval(): int
    {
        return $this->interval;
    }

    /**
     * Set the value of interval.
     */
    public function setInterval(int $interval): self
    {
        $this->interval = $interval;

        return $this;
    }

    /**
     * Get the value of unit.
     */
    public function getUnit(): string
    {
        return $this->unit;
    }

    /**
     * Set the value of unit.
     */
    public function setUnit(string $unit): self
    {
        $this->unit = $unit;

        return $this;
    }

    /**
     * Get the value of values.
     */
    public function getValues(): array
    {
        return $this->values;
    }

    /**
     * Set the value of values.
     */
    public function setValues(array $values): self
    {
        $this->values = $values;

        return $this;
    }

    /**
     * Get the value of deadline.
     */
    public function getDeadline(): ?DateTime
    {
        return $this->deadline;
    }

    /**
     * Set the value of deadline.
     */
    public function setDeadline(?DateTime $deadline): self
    {
        $this->deadline = $deadline;

        return $this;
    }

    /**
     * Get the value of month.
     */
    public function getMonth(): ?string
    {
        return $this->month;
    }

    /**
     * Set the value of month.
     */
    public function setMonth(?string $month): self
    {
        $this->month = $month;

        return $this;
    }
}
