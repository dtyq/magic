<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Agent;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Data\MentionDataInterface;
use App\Infrastructure\Core\AbstractDTO;

final class AgentData extends AbstractDTO implements MentionDataInterface
{
    protected string $agentId;

    protected string $agentName;

    protected string $agentIcon;

    protected string $agentDescription;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function getAgentId(): ?string
    {
        return $this->agentId ?? null;
    }

    public function getAgentName(): ?string
    {
        return $this->agentName ?? null;
    }

    public function getAgentIcon(): ?string
    {
        return $this->agentIcon ?? null;
    }

    public function getAgentDescription(): ?string
    {
        return $this->agentDescription ?? null;
    }

    public function setAgentId(string $agentId): void
    {
        $this->agentId = $agentId;
    }

    public function setAgentName(string $agentName): void
    {
        $this->agentName = $agentName;
    }

    public function setAgentIcon(string $agentIcon): void
    {
        $this->agentIcon = $agentIcon;
    }

    public function setAgentDescription(string $agentDescription): void
    {
        $this->agentDescription = $agentDescription;
    }
}
