<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Tiptap\CustomExtension\QuickInstruction\DeepSearch\Item;

use App\Infrastructure\Core\AbstractEntity;

class Instruction extends AbstractEntity
{
    protected ?string $id = null;

    protected ?string $on = null;

    protected ?string $off = null;

    protected ?string $name = null;

    protected ?int $type = null;

    protected ?string $content = null;

    protected ?string $defaultValue = null;

    public function getId(): ?string
    {
        return $this->id;
    }

    public function setId(?string $id): void
    {
        $this->id = $id;
    }

    public function getOn(): ?string
    {
        return $this->on;
    }

    public function setOn(?string $on): void
    {
        $this->on = $on;
    }

    public function getOff(): ?string
    {
        return $this->off;
    }

    public function setOff(?string $off): void
    {
        $this->off = $off;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(?string $name): void
    {
        $this->name = $name;
    }

    public function getType(): ?int
    {
        return $this->type;
    }

    public function setType(?int $type): void
    {
        $this->type = $type;
    }

    public function getContent(): ?string
    {
        return $this->content;
    }

    public function setContent(?string $content): void
    {
        $this->content = $content;
    }

    public function getDefaultValue(): ?string
    {
        return $this->defaultValue;
    }

    public function setDefaultValue(?string $defaultValue): void
    {
        $this->defaultValue = $defaultValue;
    }
}
