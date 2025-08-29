<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO;

class BuiltinToolDTO
{
    public string $code = '';

    public string $name = '';

    public string $description = '';

    public string $icon = '';

    public function __construct(array $data = [])
    {
        if (isset($data['code'])) {
            $this->setCode($data['code']);
        }
        if (isset($data['name'])) {
            $this->setName($data['name']);
        }
        if (isset($data['description'])) {
            $this->setDescription($data['description']);
        }
        if (isset($data['icon'])) {
            $this->setIcon($data['icon']);
        }
    }

    public function setCode(string $code): self
    {
        $this->code = $code;
        return $this;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function setName(string $name): self
    {
        $this->name = $name;
        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setDescription(string $description): self
    {
        $this->description = $description;
        return $this;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setIcon(string $icon): self
    {
        $this->icon = $icon;
        return $this;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }
}
