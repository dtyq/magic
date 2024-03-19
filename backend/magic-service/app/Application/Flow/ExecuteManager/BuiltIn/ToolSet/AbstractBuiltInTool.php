<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\BuiltIn\ToolSet;

use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Domain\Flow\Entity\ValueObject\Type;
use App\Infrastructure\Core\Contract\Flow\BuiltInToolInterface;
use DateTime;

abstract class AbstractBuiltInTool implements BuiltInToolInterface
{
    public function generateToolFlow(string $organizationCode = '', string $userId = ''): MagicFlowEntity
    {
        $toolFlow = new MagicFlowEntity();
        $toolFlow->setOrganizationCode($organizationCode);
        $toolFlow->setCode($this->getCode());
        $toolFlow->setName($this->getName());
        $toolFlow->setDescription($this->getDescription());
        $toolFlow->setType(Type::Tools);
        $toolFlow->setToolSetId($this->getToolSetCode());
        $toolFlow->setEnabled(true);
        $toolFlow->setCreator($userId ?: 'system');
        $toolFlow->setCreatedAt(new DateTime());
        $toolFlow->setModifier($userId ?: 'system');
        $toolFlow->setUpdatedAt(new DateTime());
        $toolFlow->setNodes([]);
        $toolFlow->setInput($this->getInput());
        $toolFlow->setOutput($this->getOutPut());
        $toolFlow->setEndNode($this->createEndNode());
        $toolFlow->setCustomSystemInput($this->getCustomSystemInput());
        $toolFlow->setCallback($this->getCallback());
        return $toolFlow;
    }

    public function getInput(): ?NodeInput
    {
        return null;
    }

    public function getOutPut(): ?NodeOutput
    {
        return null;
    }

    public function getCustomSystemInput(): ?NodeInput
    {
        return null;
    }

    public function getAppendSystemPrompt(array $customParams = []): string
    {
        return '';
    }

    public function isShow(): bool
    {
        return true;
    }

    public function getCode(): string
    {
        return $this->getToolSetCode() . '_' . $this->getName();
    }

    private function createEndNode(): Node
    {
        $node = Node::generateTemplate(NodeType::End, [], 'latest');
        $node->setOutput($this->getOutPut());
        return $node;
    }
}
