<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO;

class BuiltinToolCategoryDTO
{
    public string $name;

    public string $icon;

    public string $description;

    /** @var array<BuiltinToolDTO> */
    public array $tools;

    public function __construct(array $data = [])
    {
        $this->name = $data['name'] ?? '';
        $this->icon = $data['icon'] ?? '';
        $this->description = $data['description'] ?? '';
        $this->tools = $data['tools'] ?? [];
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(string $icon): void
    {
        $this->icon = $icon;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
    }

    /**
     * @return array<BuiltinToolDTO>
     */
    public function getTools(): array
    {
        return $this->tools;
    }

    /**
     * @param array<BuiltinToolDTO> $tools
     */
    public function setTools(array $tools): void
    {
        $this->tools = $tools;
    }

    public function addTool(BuiltinToolDTO $tool): void
    {
        $this->tools[] = $tool;
    }
}
