<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Event;

class BeforeCreateClawEvent
{
    public function __construct(
        private readonly string $organizationCode,
        private readonly string $userId,
        private readonly string $name,
        private readonly string $description,
        private readonly string $icon,
        private readonly string $templateCode = ''
    ) {
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

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

    public function getTemplateCode(): string
    {
        return $this->templateCode;
    }
}
