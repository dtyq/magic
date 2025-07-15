<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention;

/**
 * Agent data class.
 */
class AgentData extends MentionData
{
    /**
     * Agent ID.
     */
    protected ?string $agentId;

    /**
     * Agent name.
     */
    protected ?string $agentName;

    /**
     * Agent icon.
     */
    protected ?string $agentIcon;

    /**
     * Agent description.
     */
    protected ?string $agentDescription;

    public function getDataType(): string
    {
        return MentionType::AGENT->value;
    }

    public function getAgentId(): string
    {
        return $this->agentId ?? '';
    }

    public function setAgentId(string $agentId): void
    {
        $this->agentId = $agentId;
    }

    public function getAgentName(): string
    {
        return $this->agentName ?? '';
    }

    public function setAgentName(string $agentName): void
    {
        $this->agentName = $agentName;
    }

    public function getAgentIcon(): string
    {
        return $this->agentIcon ?? '';
    }

    public function setAgentIcon(string $agentIcon): void
    {
        $this->agentIcon = $agentIcon;
    }

    public function getAgentDescription(): string
    {
        return $this->agentDescription ?? '';
    }

    public function setAgentDescription(string $agentDescription): void
    {
        $this->agentDescription = $agentDescription;
    }
}
