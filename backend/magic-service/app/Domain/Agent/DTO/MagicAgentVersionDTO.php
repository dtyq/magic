<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\DTO;

use App\Domain\Agent\Constant\MagicAgentReleaseStatus;
use App\Domain\Agent\Entity\AbstractEntity;
use App\Domain\Agent\Entity\ValueObject\Visibility\VisibilityConfig;
use App\Domain\Agent\Entity\ValueObject\Visibility\VisibilityType;
use App\ErrorCode\AgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class MagicAgentVersionDTO extends AbstractEntity
{
    private ?string $agentId = null;

    private ?string $versionDescription = '';

    private ?int $releaseScope = null;

    private ?string $versionNumber = '';

    private string $createdUid;

    private ?VisibilityConfig $visibilityConfig = null;

    public function check()
    {
        if (empty($this->agentId)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.agent_id_is_empty');
        }

        if (strlen($this->versionDescription) > 500) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.version_description_length_cannot_exceed_500_characters');
        }

        if (! in_array($this->releaseScope, array_map(fn ($status) => $status->value, MagicAgentReleaseStatus::cases()), true)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.invalid_version_release_range');
        }

        if ($this->releaseScope === MagicAgentReleaseStatus::PUBLISHED_TO_ENTERPRISE->value) {
            $this->validatesVisibilityConfig();
        }

        if (empty($this->createdUid) || $this->createdUid <= 0) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.version_publisher_is_empty');
        }

        // 校验 $versionNumber ,遵循 语义化版本 规则
        if (! preg_match('/^\d{1,2}+\.\d{1,2}+\.\d{1,2}+$/', $this->versionNumber)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.format_error_example_1_0_0');
        }
        // 额外校验：确保 versionNumber 不是 0.0.0
        if ($this->versionNumber === '0.0.0') {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.publish_version_cannot_be_0_0_0_format');
        }
    }

    public function getAgentId(): ?string
    {
        return $this->agentId;
    }

    public function setAgentId(?string $agentId): void
    {
        $this->agentId = $agentId;
    }

    public function getVersionDescription(): ?string
    {
        return $this->versionDescription;
    }

    public function setVersionDescription(?string $versionDescription): void
    {
        $this->versionDescription = $versionDescription;
    }

    public function getReleaseScope(): ?int
    {
        return $this->releaseScope;
    }

    public function setReleaseScope(?int $releaseScope): void
    {
        $this->releaseScope = $releaseScope;
    }

    public function getCreatedUid(): string
    {
        return $this->createdUid;
    }

    public function setCreatedUid(string $createdUid): void
    {
        $this->createdUid = $createdUid;
    }

    public function getVersionNumber(): ?string
    {
        return $this->versionNumber;
    }

    public function setVersionNumber(?string $versionNumber): void
    {
        $this->versionNumber = $versionNumber;
    }

    public function getVisibilityConfig(): ?VisibilityConfig
    {
        return $this->visibilityConfig;
    }

    public function setVisibilityConfig(null|array|VisibilityConfig $visibilityConfig): self
    {
        if (is_array($visibilityConfig)) {
            $visibilityConfig = new VisibilityConfig($visibilityConfig);
        }
        $this->visibilityConfig = $visibilityConfig;
        return $this;
    }

    /**
     * 验证可见性配置格式.
     */
    private function validatesVisibilityConfig(): void
    {
        $visibilityConfig = $this->visibilityConfig;

        if (! $visibilityConfig) {
            $visibilityConfig = new VisibilityConfig();
        }

        $visibilityType = VisibilityType::tryFrom($visibilityConfig->getVisibilityType());
        // 验证visibility_type字段
        if (! $visibilityType) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.invalid_visibility_type');
        }
    }
}
