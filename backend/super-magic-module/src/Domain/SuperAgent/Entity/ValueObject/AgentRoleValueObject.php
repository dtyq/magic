<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * Agent role information value object.
 * Contains localized name and description for the agent role.
 */
class AgentRoleValueObject
{
    /**
     * Constructor.
     *
     * @param string $name Agent role name (already localized)
     * @param string $description Agent role description (already localized)
     */
    public function __construct(
        private string $name = '',
        private string $description = ''
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

    /**
     * Convert to array.
     *
     * @return array{name: string, description: string}
     */
    public function toArray(): array
    {
        return [
            'name' => $this->name,
            'description' => $this->description,
        ];
    }

    /**
     * Check if the role is empty.
     */
    public function isEmpty(): bool
    {
        return $this->name === '' && $this->description === '';
    }
}
