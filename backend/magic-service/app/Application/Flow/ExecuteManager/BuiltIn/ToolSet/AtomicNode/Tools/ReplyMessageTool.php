<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\AtomicNode\Tools;

use App\Application\Flow\ExecuteManager\BuiltIn\BuiltInToolSet;
use App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\AbstractBuiltInTool;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Collector\BuiltInToolSet\Annotation\BuiltInToolDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use Closure;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\Expression\Value;
use Dtyq\FlowExprEngine\Structure\StructureType;

#[BuiltInToolDefine]
class ReplyMessageTool extends AbstractBuiltInTool
{
    public function getToolSetCode(): string
    {
        return BuiltInToolSet::AtomicNode->getCode();
    }

    public function getName(): string
    {
        return 'reply_message';
    }

    public function getDescription(): string
    {
        return '回复一段指定内容给用户';
    }

    public function getCallback(): ?Closure
    {
        return function (ExecutionData $executionData) {
            $params = $executionData->getTriggerData()->getParams();

            $node = Node::generateTemplate(NodeType::ReplyMessage, [
                'type' => $params['type'] ?? 'text',
                'content' => ComponentFactory::fastCreate([
                    'type' => StructureType::Value,
                    'structure' => Value::buildConst($params['content'] ?? ''),
                ]),
            ], 'latest');

            $runner = NodeRunnerFactory::make($node);
            $vertexResult = new VertexResult();
            $runner->execute($vertexResult, clone $executionData);
            return $vertexResult->getResult();
        };
    }

    public function getInput(): ?NodeInput
    {
        $nodeInput = new NodeInput();
        $nodeInput->setForm(ComponentFactory::generateTemplate(StructureType::Form, json_decode(
            <<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": "root",
    "description": "",
    "items": null,
    "value": null,
    "required": [
        "type",
        "content"
    ],
    "properties": {
        "type": {
            "type": "string",
            "key": "type",
            "title": "消息类型",
            "description": "消息类型；可用类型有 text、markdown、image、video、audio、file，默认是 text",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "content": {
            "type": "string",
            "key": "content",
            "title": "消息内容",
            "description": "消息内容",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        }
    }
}
JSON,
            true
        )));
        return $nodeInput;
    }
}
