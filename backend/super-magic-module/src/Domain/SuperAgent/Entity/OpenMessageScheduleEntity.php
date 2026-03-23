<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

/**
 * Open API message schedule entity.
 * Carries API-layer normalized fields into AppService.
 */
class OpenMessageScheduleEntity extends MessageScheduleEntity
{
    private ?string $messageContentText = null;

    private ?string $modelId = null;

    private bool $taskNameSpecified = false;

    private bool $messageContentTextSpecified = false;

    private bool $timeConfigSpecified = false;

    private bool $enabledSpecified = false;

    private bool $modelIdSpecified = false;

    private bool $deadlineSpecified = false;

    /** 是否指定话题：0=否，1=是 */
    private int $specifyTopic = 0;

    public function setSpecifyTopic(int $specifyTopic): self
    {
        $this->specifyTopic = $specifyTopic;
        return $this;
    }

    public function getSpecifyTopic(): int
    {
        return $this->specifyTopic;
    }

    public function setOpenTaskName(?string $taskName): self
    {
        $this->taskNameSpecified = true;
        if ($taskName !== null) {
            $this->setTaskName($taskName);
        }

        return $this;
    }

    public function hasTaskNameInput(): bool
    {
        return $this->taskNameSpecified;
    }

    public function setMessageContentText(?string $messageContentText): self
    {
        $this->messageContentTextSpecified = true;
        $this->messageContentText = $messageContentText;

        return $this;
    }

    public function hasMessageContentTextInput(): bool
    {
        return $this->messageContentTextSpecified;
    }

    public function getMessageContentText(): ?string
    {
        return $this->messageContentText;
    }

    public function setOpenTimeConfig(?array $timeConfig): self
    {
        $this->timeConfigSpecified = true;
        if ($timeConfig !== null) {
            $this->setTimeConfig($timeConfig);
        }

        return $this;
    }

    public function hasTimeConfigInput(): bool
    {
        return $this->timeConfigSpecified;
    }

    public function setOpenEnabled(?int $enabled): self
    {
        $this->enabledSpecified = true;
        if ($enabled !== null) {
            $this->setEnabled($enabled);
        }

        return $this;
    }

    public function hasEnabledInput(): bool
    {
        return $this->enabledSpecified;
    }

    public function setModelId(?string $modelId): self
    {
        $this->modelIdSpecified = true;
        $this->modelId = $modelId;

        return $this;
    }

    public function hasModelIdInput(): bool
    {
        return $this->modelIdSpecified;
    }

    public function getModelId(): ?string
    {
        return $this->modelId;
    }

    public function setOpenDeadline(?string $deadline): self
    {
        $this->deadlineSpecified = true;
        $this->setDeadline($deadline);

        return $this;
    }

    public function hasDeadlineInput(): bool
    {
        return $this->deadlineSpecified;
    }
}
