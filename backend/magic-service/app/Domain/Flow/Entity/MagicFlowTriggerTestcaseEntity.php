<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity;

use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\TriggerType;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Carbon\Carbon;
use DateTime;

class MagicFlowTriggerTestcaseEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $flowCode;

    protected string $code;

    protected string $name;

    protected string $description = '';

    protected array $caseConfig = [];

    protected string $organizationCode;

    protected string $creator;

    protected DateTime $createdAt;

    protected string $modifier;

    protected DateTime $updatedAt;

    public function shouldCreate(): bool
    {
        return empty($this->code);
    }

    public function prepareForCreation(): void
    {
        $this->requiredValidate();

        $this->code = $this->generateCode();
        $this->modifier = $this->creator;
        $this->updatedAt = $this->createdAt;
    }

    public function prepareForModification(MagicFlowTriggerTestcaseEntity $magicFlowTriggerTestcaseEntity): void
    {
        $this->requiredValidate();

        $magicFlowTriggerTestcaseEntity->setName($this->name);
        $magicFlowTriggerTestcaseEntity->setDescription($this->description);
        $magicFlowTriggerTestcaseEntity->setCaseConfig($this->caseConfig);
        $magicFlowTriggerTestcaseEntity->setModifier($this->creator);
        $magicFlowTriggerTestcaseEntity->setUpdatedAt($this->createdAt);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getFlowCode(): string
    {
        return $this->flowCode;
    }

    public function setFlowCode(string $flowCode): void
    {
        $this->flowCode = $flowCode;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): void
    {
        $this->code = $code;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
    }

    public function getCaseConfig(): array
    {
        return $this->caseConfig;
    }

    public function setCaseConfig(array $caseConfig): void
    {
        $this->caseConfig = $caseConfig;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getCreator(): string
    {
        return $this->creator;
    }

    public function setCreator(string $creator): void
    {
        $this->creator = $creator;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getModifier(): string
    {
        return $this->modifier;
    }

    public function setModifier(string $modifier): void
    {
        $this->modifier = $modifier;
    }

    public function getUpdatedAt(): DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(DateTime $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    private function requiredValidate(): void
    {
        if (empty($this->name)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.test_case_name']);
        }
        if (empty($this->flowCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.flow_code']);
        }
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.organization_code']);
        }
        if (empty($this->creator)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.creator']);
        }
        if (empty($this->createdAt)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.created_at']);
        }
        $this->checkCaseConfig();
    }

    private function checkCaseConfig(): void
    {
        if (empty($this->caseConfig)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.case_config']);
        }
        $triggerType = TriggerType::tryFrom($this->caseConfig['trigger_type'] ?? 0);
        $conversationId = $this->caseConfig['conversation_id'] ?? '';
        $triggerData = $this->caseConfig['trigger_data'] ?? [];
        switch ($triggerType) {
            case TriggerType::ChatMessage:
                if (! isset($triggerData['nickname'])) {
                    ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.nickname']);
                }
                if (! isset($triggerData['chat_time']) || ! Carbon::make($triggerData['chat_time'])) {
                    ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.chat_time']);
                }
                if (! isset($triggerData['message_type'])) {
                    ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.message_type']);
                }
                if (! isset($triggerData['content'])) {
                    ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.content']);
                }
                break;
            case TriggerType::OpenChatWindow:
                if (! isset($triggerData['nickname'])) {
                    ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.nickname']);
                }
                if (! isset($triggerData['open_time']) || ! Carbon::make($triggerData['open_time'])) {
                    ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.open_time']);
                }
                break;
            case TriggerType::ParamCall:
                // 参数调用不校验了
                break;
            default:
                ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.invalid', ['label' => 'flow.fields.trigger_type']);
        }

        $this->caseConfig = [
            'trigger_type' => $triggerType->value,
            'conversation_id' => $conversationId,
            'trigger_data' => $triggerData,
        ];
    }

    private function generateCode(): string
    {
        return 'MAGIC-FLOW-TRIGGER-TESTCASE-' . str_replace('.', '-', uniqid('', true));
    }
}
