<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity;

use App\Domain\Flow\Entity\ValueObject\Code;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;

class MagicFlowVersionEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $flowCode;

    protected string $code;

    protected string $name;

    protected string $description = '';

    protected MagicFlowEntity $magicFlow;

    protected string $organizationCode;

    protected string $creator;

    protected DateTime $createdAt;

    protected string $modifier;

    protected DateTime $updatedAt;

    public function prepareForCreation(): void
    {
        $this->requiredValidate();

        $this->code = Code::MagicFlowVersion->gen();
        $this->modifier = $this->creator;
        $this->updatedAt = $this->createdAt;

        $magicFlow = $this->magicFlow;
        $this->magicFlowPrepareForSave($magicFlow);
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

    public function getMagicFlow(): MagicFlowEntity
    {
        return $this->magicFlow;
    }

    public function setMagicFlow(MagicFlowEntity $magicFlow): void
    {
        $this->magicFlow = $magicFlow;
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

    private function magicFlowPrepareForSave(MagicFlowEntity $magicFlow): void
    {
        $magicFlow->setCode($this->flowCode);
        $magicFlow->setOrganizationCode($this->organizationCode);
        $magicFlow->setCreator($this->creator);
        $magicFlow->setCreatedAt($this->createdAt);
        $magicFlow->setModifier($this->creator);
        $magicFlow->setUpdatedAt($this->createdAt);
    }

    private function requiredValidate(): void
    {
        if (empty($this->name)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.name.empty');
        }
        if (empty($this->flowCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.flow_code.empty');
        }
        if (empty($this->magicFlow)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.flow_entity.empty');
        }
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.organization_code.empty');
        }
        if (empty($this->creator)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.creator.empty');
        }
        if (empty($this->createdAt)) {
            $this->createdAt = new DateTime();
        }
    }
}
