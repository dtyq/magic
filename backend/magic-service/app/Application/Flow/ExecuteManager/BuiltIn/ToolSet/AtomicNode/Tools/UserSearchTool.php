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
class UserSearchTool extends AbstractBuiltInTool
{
    public function getToolSetCode(): string
    {
        return BuiltInToolSet::AtomicNode->getCode();
    }

    public function getName(): string
    {
        return 'user_search';
    }

    public function getDescription(): string
    {
        return '用户搜索。不允许搜索全部人员，一定是具有指定过滤值';
    }

    public function getCallback(): ?Closure
    {
        return function (ExecutionData $executionData) {
            $params = $executionData->getTriggerData()->getParams();

            $filters = [];
            foreach ($params['filters'] ?? [] as $filter) {
                if (empty($filter['left']) || empty($filter['operator']) || empty($filter['right'])) {
                    continue;
                }
                $filters[] = [
                    'left' => $filter['left'],
                    'operator' => $filter['operator'],
                    'right' => ComponentFactory::fastCreate([
                        'type' => StructureType::Value,
                        'structure' => Value::buildConst($filter['right']),
                    ]),
                ];
            }

            $node = Node::generateTemplate(NodeType::UserSearch, [
                'filter_type' => $params['filter_type'] ?? 'all',
                'filters' => $filters,
            ], 'latest');

            $runner = NodeRunnerFactory::make($node);
            $vertexResult = new VertexResult();
            $runner->execute($vertexResult, clone $executionData);
            return $vertexResult->getResult();
        };
    }

    public function getInput(): ?NodeInput
    {
        $input = new NodeInput();
        $input->setForm(ComponentFactory::generateTemplate(StructureType::Form, json_decode(
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
        "filter_type",
        "filters"
    ],
    "properties": {
        "filter_type": {
            "type": "string",
            "key": "filter_type",
            "title": "过滤类型",
            "description": "过滤类型。支持的过滤类型有：all、any。分别代表 所有条件、任意条件。默认是 all",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "filters": {
            "type": "array",
            "key": "filters",
            "title": "过滤条件",
            "description": "过滤条件",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": {
                "type": "object",
                "key": "filters",
                "title": "filters",
                "description": "",
                "required": [
                    "left",
                    "operator",
                    "right"
                ],
                "value": null,
                "properties": {
                    "left": {
                        "type": "string",
                        "key": "field",
                        "title": "过滤字段",
                        "description": "过滤字段。可选枚举有：username、work_number、position、position、department_name、group_name。分别代表  用户姓名、用户工号、用户岗位、用户手机号、部门名称、群聊名称",
                        "required": null,
                        "value": null,
                        "encryption": false,
                        "encryption_value": null,
                        "items": null,
                        "properties": null
                    },
                    "operator": {
                        "type": "string",
                        "key": "operator",
                        "title": "过滤符",
                        "description": "过滤符。可选枚举有：equals、no_equals、contains、no_contains。分别代表 等于、不等于、包含、不包含",
                        "required": null,
                        "value": null,
                        "encryption": false,
                        "encryption_value": null,
                        "items": null,
                        "properties": null
                    },
                    "right": {
                        "type": "string",
                        "key": "value",
                        "title": "过滤值",
                        "description": "过滤值",
                        "required": null,
                        "value": null,
                        "encryption": false,
                        "encryption_value": null,
                        "items": null,
                        "properties": null
                    }
                }
            },
            "properties": null
        }
    }
}
JSON,
            true
        )));
        return $input;
    }
}
