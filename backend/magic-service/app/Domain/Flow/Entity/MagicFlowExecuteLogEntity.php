<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity;

use App\Domain\Flow\Entity\ValueObject\ExecuteLogStatus;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;

class MagicFlowExecuteLogEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $executeDataId;

    protected string $conversationId;

    protected string $organizationCode;

    protected string $flowCode;

    protected string $flowVersionCode = '';

    protected int $flowType = 0;

    protected string $parentFlowCode = '';

    protected string $operatorId = '';

    protected int $level = 0;

    protected string $executionType = '';

    protected ExecuteLogStatus $status;

    protected array $extParams = [];

    protected array $result = [];

    protected DateTime $createdAt;

    protected int $retryCount = 0;

    public function prepareForCreation(): void
    {
        if (empty($this->executeDataId)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'execute_data_id']);
        }
        if (empty($this->conversationId)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'conversation_id']);
        }
        if (empty($this->flowCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow_code']);
        }
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'organization_code']);
        }
        if (empty($this->operatorId)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'operator_id']);
        }
        if (empty($this->executionType)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'execution_type']);
        }
        if (empty($this->flowType)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow_type']);
        }
        if (empty($this->createdAt)) {
            $this->createdAt = new DateTime();
        }
        $this->status = ExecuteLogStatus::Pending;
    }

    public function isTop(): bool
    {
        return $this->level === 0;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getExecuteDataId(): string
    {
        return $this->executeDataId;
    }

    public function setExecuteDataId(string $executeDataId): void
    {
        $this->executeDataId = $executeDataId;
    }

    public function getOperatorId(): string
    {
        return $this->operatorId;
    }

    public function setOperatorId(string $operatorId): void
    {
        $this->operatorId = $operatorId;
    }

    public function getParentFlowCode(): string
    {
        return $this->parentFlowCode;
    }

    public function setParentFlowCode(string $parentFlowCode): void
    {
        $this->parentFlowCode = $parentFlowCode;
    }

    public function getLevel(): int
    {
        return $this->level;
    }

    public function setLevel(int $level): void
    {
        $this->level = $level;
    }

    public function getFlowType(): int
    {
        return $this->flowType;
    }

    public function setFlowType(int $flowType): void
    {
        $this->flowType = $flowType;
    }

    public function getExecutionType(): string
    {
        return $this->executionType;
    }

    public function setExecutionType(string $executionType): void
    {
        $this->executionType = $executionType;
    }

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function setConversationId(string $conversationId): void
    {
        $this->conversationId = $conversationId;
    }

    public function getFlowCode(): string
    {
        return $this->flowCode;
    }

    public function setFlowCode(string $flowCode): void
    {
        $this->flowCode = $flowCode;
    }

    public function getFlowVersionCode(): string
    {
        return $this->flowVersionCode;
    }

    public function setFlowVersionCode(string $flowVersionCode): void
    {
        $this->flowVersionCode = $flowVersionCode;
    }

    public function getStatus(): ExecuteLogStatus
    {
        return $this->status;
    }

    public function setStatus(ExecuteLogStatus $status): void
    {
        $this->status = $status;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getExtParams(): array
    {
        return $this->extParams;
    }

    public function setExtParams(array $extParams): void
    {
        $this->extParams = $extParams;
    }

    public function getResult(): array
    {
        return $this->result;
    }

    public function setResult(array $result): void
    {
        $this->result = $result;
    }

    public function getRetryCount(): int
    {
        return $this->retryCount;
    }

    public function setRetryCount(int $retryCount): void
    {
        $this->retryCount = $retryCount;
    }
}
