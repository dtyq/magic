<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * Agent profile information value object.
 * Contains identity and template details for a specific agent type (custom_agent, magiclaw, etc.).
 */
class AgentProfileValueObject
{
    public function __construct(
        private string $code = '',
        private string $name = '',
        private string $description = '',
        private string $templateCode = '',
    ) {
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function getTemplateCode(): string
    {
        return $this->templateCode;
    }

    /**
     * Convert to array.
     *
     * @return array{code: string, name: string, description: string, template_code: string}
     */
    public function toArray(): array
    {
        return [
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'template_code' => $this->templateCode,
        ];
    }
}
