<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Kernel\DTO\Traits;

use App\Interfaces\Kernel\DTO\OperatorDTO;
use Dtyq\FlowExprEngine\Component;
use Dtyq\FlowExprEngine\ComponentFactory;

trait OperatorDTOTrait
{
    protected ?string $creator = null;

    protected ?string $modifier = null;

    protected ?string $createdUid = null;

    protected ?string $createdAt = null;

    protected ?string $updatedUid = null;

    protected ?string $updatedAt = null;

    protected ?OperatorDTO $creatorInfo = null;

    protected ?OperatorDTO $modifierInfo = null;

    public function getCreator(): ?string
    {
        return $this->creator;
    }

    public function setCreator(?string $creator): void
    {
        $this->creator = $creator;
    }

    public function getModifier(): ?string
    {
        return $this->modifier;
    }

    public function setModifier(?string $modifier): void
    {
        $this->modifier = $modifier;
    }

    public function getCreatedUid(): ?string
    {
        return $this->createdUid;
    }

    public function setCreatedUid(?string $createdUid): void
    {
        $this->createdUid = $createdUid;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(mixed $createdAt): void
    {
        $this->createdAt = $this->createDateTimeString($createdAt);
    }

    public function getUpdatedUid(): ?string
    {
        return $this->updatedUid;
    }

    public function setUpdatedUid(?string $updatedUid): void
    {
        $this->updatedUid = $updatedUid;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(mixed $updatedAt): void
    {
        $this->updatedAt = $this->createDateTimeString($updatedAt);
    }

    public function getCreatorInfo(): ?OperatorDTO
    {
        return $this->creatorInfo;
    }

    public function setCreatorInfo(null|array|OperatorDTO $creatorInfo): void
    {
        if (is_array($creatorInfo)) {
            $creatorInfo = new OperatorDTO($creatorInfo);
        }
        $this->creatorInfo = $creatorInfo;
    }

    public function getModifierInfo(): ?OperatorDTO
    {
        return $this->modifierInfo;
    }

    public function setModifierInfo(null|array|OperatorDTO $modifierInfo): void
    {
        if (is_array($modifierInfo)) {
            $modifierInfo = new OperatorDTO($modifierInfo);
        }
        $this->modifierInfo = $modifierInfo;
    }

    protected function createComponent(mixed $value): ?Component
    {
        if (is_null($value)) {
            return null;
        }
        if ($value instanceof Component) {
            return $value;
        }
        if (is_array($value)) {
            return ComponentFactory::fastCreate($value, lazy: true);
        }
        return null;
    }
}
