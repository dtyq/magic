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

class MagicFlowDraftEntity extends AbstractEntity
{
    /**
     * 最大记录数.
     */
    public const int MAX_RECORD = 50;

    protected ?int $id = null;

    protected string $organizationCode;

    protected string $flowCode;

    protected string $code;

    protected string $name;

    protected string $description = '';

    protected ?array $magicFlow = null;

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

        $this->code = Code::MagicFlowDraft->gen();
        $this->modifier = $this->creator;
        $this->updatedAt = $this->createdAt;
    }

    public function prepareForModification(MagicFlowDraftEntity $magicFlowDraftEntity): void
    {
        $this->requiredValidate();

        $magicFlowDraftEntity->setName($this->name);
        $magicFlowDraftEntity->setDescription($this->description);
        $magicFlowDraftEntity->setModifier($this->creator);
        $magicFlowDraftEntity->setUpdatedAt($this->createdAt);

        if (! is_null($this->magicFlow)) {
            $magicFlowDraftEntity->setMagicFlow($this->magicFlow);
        }
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

    public function getMagicFlow(): ?array
    {
        return $this->magicFlow;
    }

    public function setMagicFlow(?array $magicFlow): void
    {
        $this->magicFlow = $magicFlow;
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
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.flow_name']);
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
            $this->createdAt = new DateTime();
        }
    }
}
