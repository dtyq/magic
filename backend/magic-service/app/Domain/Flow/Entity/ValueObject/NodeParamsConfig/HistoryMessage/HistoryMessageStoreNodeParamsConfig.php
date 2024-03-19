<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\HistoryMessage;

use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\MagicFlowMessageType;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use Dtyq\FlowExprEngine\Component;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

class HistoryMessageStoreNodeParamsConfig extends NodeParamsConfig
{
    private MagicFlowMessageType $type;

    private ?Component $content = null;

    private ?Component $link = null;

    private ?Component $linkDesc = null;

    public function getType(): MagicFlowMessageType
    {
        return $this->type;
    }

    public function getContent(): ?Component
    {
        return $this->content;
    }

    public function getLink(): ?Component
    {
        return $this->link;
    }

    public function getLinkDesc(): ?Component
    {
        return $this->linkDesc;
    }

    public function validate(): array
    {
        $data = MagicFlowMessageType::validateParams($this->node->getParams());
        $this->type = $data['type'];
        $this->content = $data['content'];
        $this->link = $data['link'];
        $this->linkDesc = $data['link_desc'];
        return [
            'type' => $this->type->value,
            'content' => $this->content?->toArray(),
            'link' => $this->link?->toArray(),
            'link_desc' => $this->linkDesc?->toArray(),
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            'type' => MagicFlowMessageType::Text,
            'content' => ComponentFactory::generateTemplate(StructureType::Value)->toArray(),
            'link' => ComponentFactory::generateTemplate(StructureType::Value)->toArray(),
            'link_desc' => ComponentFactory::generateTemplate(StructureType::Value)->toArray(),
        ]);
    }
}
