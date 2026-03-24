<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * Agent role information value object.
 * Contains localized name and description for the agent role,
 * with optional type and profile for specific agent modes.
 */
class AgentRoleValueObject
{
    public function __construct(
        private string $name = '',
        private string $description = '',
        private string $type = '',
        private ?AgentProfileValueObject $profile = null,
    ) {
    }

    /**
     * Get agent name.
     */
    public function getName(): string
    {
        return $this->name;
    }

    /**
     * Get agent description.
     */
    public function getDescription(): string
    {
        return $this->description;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function getProfile(): ?AgentProfileValueObject
    {
        return $this->profile;
    }

    /**
     * Convert to array.
     * When type is empty, outputs backward-compatible {name, description} format.
     */
    public function toArray(): array
    {
        $result = [
            'name' => $this->name,
            'description' => $this->description,
        ];

        if ($this->type !== '') {
            $result['type'] = $this->type;
            $result['profile'] = $this->profile?->toArray();
        }

        return $result;
    }

    /**
     * Check if the role is empty.
     */
    public function isEmpty(): bool
    {
        return $this->name === '' && $this->description === '';
    }
}
