<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity;

use App\Infrastructure\Core\AbstractEntity;

class MagicUserTaskEntity extends AbstractEntity
{
    protected string $name;

    protected string $type;

    protected string $day;

    protected string $time;

    protected MagicUserTaskValueEntity $value;

    /**
     * Get the value of name.
     */
    public function getName(): string
    {
        return $this->name;
    }

    /**
     * Set the value of name.
     */
    public function setName(string $name): self
    {
        $this->name = $name;

        return $this;
    }

    /**
     * Get the value of type.
     */
    public function getType(): string
    {
        return $this->type;
    }

    /**
     * Set the value of type.
     */
    public function setType(string $type): self
    {
        $this->type = $type;

        return $this;
    }

    /**
     * Get the value of day.
     */
    public function getDay(): string
    {
        return $this->day;
    }

    /**
     * Set the value of day.
     */
    public function setDay(string $day): self
    {
        $this->day = $day;

        return $this;
    }

    /**
     * Get the value of time.
     */
    public function getTime(): string
    {
        return $this->time;
    }

    /**
     * Set the value of time.
     */
    public function setTime(string $time): self
    {
        $this->time = $time;

        return $this;
    }

    /**
     * Get the value of value.
     */
    public function getValue(): MagicUserTaskValueEntity
    {
        return $this->value;
    }

    /**
     * Set the value of value.
     */
    public function setValue(MagicUserTaskValueEntity $value): self
    {
        $this->value = $value;

        return $this;
    }
}
