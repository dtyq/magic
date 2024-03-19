<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\DTO;

use App\Domain\Agent\Entity\AbstractEntity;
use App\Domain\Agent\Entity\MagicAgentEntity;
use App\ErrorCode\AgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class MagicAgentDTO extends AbstractEntity
{
    /**
     * 主键.
     */
    private ?string $id = '';

    /**
     * 助理名称.
     */
    private ?string $agentName = '';

    private ?string $robotName = '';

    /**
     * 助理头像.
     */
    private ?string $agentAvatar = '';

    private ?string $robotAvatar = '';

    /**
     * 助理描述.
     */
    private string $agentDescription = '';

    private ?string $robotDescription = '';

    /**
     * 当前组织编码
     */
    private string $currentOrganizationCode = '';

    /**
     * 当前的用户id.
     */
    private string $currentUserId = '';

    private bool $startPage = false;

    public function toEntity(): MagicAgentEntity
    {
        $this->validateBasicFields();

        $magicAgentEntity = new MagicAgentEntity();
        $magicAgentEntity->setId($this->id);
        $magicAgentEntity->setAgentName($this->getAgentName());
        $magicAgentEntity->setAgentAvatar($this->getAgentAvatar());
        $magicAgentEntity->setAgentDescription($this->getAgentDescription());

        $magicAgentEntity->setRobotName($this->getAgentName());
        $magicAgentEntity->setRobotDescription($this->getAgentDescription());
        $magicAgentEntity->setRobotAvatar($this->getAgentAvatar());

        $magicAgentEntity->setOrganizationCode($this->currentOrganizationCode);
        $magicAgentEntity->setCreatedUid($this->currentUserId);
        $magicAgentEntity->setStartPage($this->startPage);

        return $magicAgentEntity;
    }

    public function getCurrentOrganizationCode(): string
    {
        return $this->currentOrganizationCode;
    }

    public function setCurrentOrganizationCode(string $currentOrganizationCode): void
    {
        $this->currentOrganizationCode = $currentOrganizationCode;
    }

    public function getCurrentUserId(): string
    {
        return $this->currentUserId;
    }

    public function setCurrentUserId(string $currentUserId): void
    {
        $this->currentUserId = $currentUserId;
    }

    public function getId(): ?string
    {
        return $this->id;
    }

    public function setId(?string $id): void
    {
        $this->id = $id;
    }

    public function getAgentName(): ?string
    {
        return $this->agentName;
    }

    public function setAgentName(?string $agentName): void
    {
        $this->agentName = $agentName;
        $this->robotName = $agentName;
    }

    public function getAgentAvatar(): ?string
    {
        return $this->agentAvatar;
    }

    public function setAgentAvatar(?string $agentAvatar): void
    {
        $this->agentAvatar = $agentAvatar;
        $this->robotDescription = $agentAvatar;
    }

    public function getAgentDescription(): string
    {
        return $this->agentDescription;
    }

    public function setAgentDescription(string $agentDescription): void
    {
        $this->agentDescription = $agentDescription;
        $this->robotDescription = $agentDescription;
    }

    public function setStartPage(bool $startPage): void
    {
        $this->startPage = $startPage;
    }

    public function getStartPage(): bool
    {
        return $this->startPage;
    }

    public function getRobotName(): ?string
    {
        return $this->robotName;
    }

    public function setRobotName(?string $robotName): void
    {
        $this->robotName = $robotName;
    }

    public function getRobotAvatar(): ?string
    {
        return $this->robotAvatar;
    }

    public function setRobotAvatar(?string $robotAvatar): void
    {
        $this->robotAvatar = $robotAvatar;
    }

    public function getRobotDescription(): ?string
    {
        return $this->robotDescription;
    }

    public function setRobotDescription(?string $robotDescription): void
    {
        $this->robotDescription = $robotDescription;
    }

    private function validateBasicFields(): void
    {
        if (preg_match('/^\s*$/', $this->agentName)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.agent_name_cannot_be_empty');
        }

        if (preg_match('/^\s*$/', $this->agentDescription)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.parameter_check_failure');
        }

        if (preg_match('/^\s*$/', $this->currentOrganizationCode)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.organization_code_cannot_be_empty');
        }

        if (empty($this->currentUserId)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.creator_cannot_be_empty');
        }

        if (mb_strlen($this->getAgentName()) > 20) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.agent_name_length_cannot_exceed_20_characters');
        }
    }
}
