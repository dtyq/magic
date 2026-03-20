<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class CreateMagicClawRequestDTO extends AbstractRequestDTO
{
    /**
     * Claw name.
     */
    public string $name = '';

    /**
     * Claw description.
     */
    public string $description = '';

    /**
     * Icon file key.
     */
    public string $icon = '';

    public function getName(): string
    {
        return $this->name;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:500',
            'icon' => 'nullable|string|max:512',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'name.required' => 'Name cannot be empty',
            'name.string' => 'Name must be a string',
            'name.max' => 'Name cannot exceed 255 characters',
            'description.string' => 'Description must be a string',
            'description.max' => 'Description cannot exceed 500 characters',
            'icon.string' => 'Icon must be a string',
            'icon.max' => 'Icon cannot exceed 512 characters',
        ];
    }
}
