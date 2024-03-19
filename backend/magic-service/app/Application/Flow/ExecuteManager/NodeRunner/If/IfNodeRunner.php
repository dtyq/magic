<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\If;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunner;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\If\IfNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use Dtyq\FlowExprEngine\ComponentFactory;

#[FlowNodeDefine(type: NodeType::If->value, code: NodeType::If->name, name: '选择器', paramsConfig: IfNodeParamsConfig::class, version: 'v0', singleDebug: false, needInput: false, needOutput: false)]
class IfNodeRunner extends NodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        $params = $this->node->getParams();

        $branches = $params['branches'] ?? [];
        if (empty($branches)) {
            $vertexResult->setChildrenIds([]);
            return;
        }

        $debug = [];

        $elseBranch = [];
        $if = false;

        $nextNodes = [];
        foreach ($branches as $branch) {
            if ($branch['branch_type'] === 'else') {
                $elseBranch = $branch;
                continue;
            }
            $component = ComponentFactory::fastCreate($branch['parameters'] ?? []);
            if (! $component?->isCondition()) {
                continue;
            }
            $condition = $component->getCondition()->getResult($executionData->getExpressionFieldData());
            if ($condition) {
                // 满足条件就会走
                $nextNodes = array_merge($nextNodes, $branch['next_nodes'] ?? []);
                // 命中 if
                $if = true;
            }
            $debug[] = [
                'branch' => $branch,
                'condition' => $condition,
            ];
        }

        // 如果没有命中 if，就走else
        if (! $if && $elseBranch) {
            $nextNodes = $elseBranch['next_nodes'] ?? [];
            $debug[] = [
                'branch' => $elseBranch,
                'condition' => true,
            ];
        }
        $vertexResult->setDebugLog($debug);

        $vertexResult->setChildrenIds(array_values(array_unique($nextNodes)));
    }
}
