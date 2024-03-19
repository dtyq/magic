<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\BuiltIn\ToolSet;

use App\Domain\Flow\Entity\MagicFlowToolSetEntity;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Infrastructure\Core\Contract\Flow\BuiltInToolInterface;
use App\Infrastructure\Core\Contract\Flow\BuiltInToolSetInterface;
use DateTime;

abstract class AbstractBuiltInToolSet implements BuiltInToolSetInterface
{
    /**
     * @var array<string, BuiltInToolInterface>
     */
    protected array $tools = [];

    public function isShow(): bool
    {
        return true;
    }

    /**
     * @return array<string, BuiltInToolInterface>
     */
    public function getTools(): array
    {
        return $this->tools;
    }

    /**
     * @param array<string, BuiltInToolInterface> $tools
     */
    public function setTools(array $tools): void
    {
        $this->tools = $tools;
    }

    public function addTool(BuiltInToolInterface $tool): void
    {
        $this->tools[$tool->getCode()] = $tool;
    }

    public function generateToolSet(): MagicFlowToolSetEntity
    {
        $toolSet = new MagicFlowToolSetEntity();
        $toolSet->setId(0);
        $toolSet->setCode($this->getCode());
        $toolSet->setName($this->getName());
        $toolSet->setDescription($this->getDescription());
        $toolSet->setIcon($this->getIcon());
        $toolSet->setEnabled(true);
        $toolSet->setUserOperation(Operation::Read->value);
        $toolSet->setCreator('system');
        $toolSet->setCreatedAt(new DateTime());
        $toolSet->setModifier('system');
        $toolSet->setUpdatedAt(new DateTime());
        return $toolSet;
    }

    public function getIcon(): string
    {
        return '';
    }
}
