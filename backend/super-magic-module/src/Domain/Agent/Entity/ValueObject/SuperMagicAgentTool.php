<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;

class SuperMagicAgentTool extends AbstractValueObject
{
    protected string $code;

    protected string $name;

    protected string $description;

    protected string $icon = '';

    protected SuperMagicAgentToolType $type;

    protected ?array $schema = null;

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

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(string $icon): void
    {
        $this->icon = $icon;
    }

    public function getType(): SuperMagicAgentToolType
    {
        return $this->type;
    }

    public function setType(int|SuperMagicAgentToolType $type): void
    {
        if (is_int($type)) {
            $type = SuperMagicAgentToolType::tryFrom($type);
            if ($type === null) {
                ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.invalid', ['label' => 'super_magic.agent.fields.tools']);
            }
        }
        $this->type = $type;
    }

    public function getSchema(): ?array
    {
        return $this->schema;
    }

    public function setSchema(?array $schema): void
    {
        $this->schema = $schema;
    }
}
