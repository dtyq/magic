<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\If;

use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

class IfNodeParamsConfig extends NodeParamsConfig
{
    public function validate(): array
    {
        $params = $this->node->getParams();

        $branches = $params['branches'] ?? [];
        if (empty($branches)) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.common.empty', ['label' => 'branches']);
        }

        $list = [];
        foreach ($branches as $branch) {
            $parameters = $branch['parameters'] ?? [];
            $component = ComponentFactory::fastCreate($parameters);
            if ($component && ! $component->isCondition()) {
                ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'parameters']);
            }
            $list[] = [
                'branch_id' => $branch['branch_id'] ?? '',
                'branch_type' => $branch['branch_type'] ?? '',
                'next_nodes' => $branch['next_nodes'] ?? [],
                'parameters' => $component?->jsonSerialize(),
            ];
        }

        return [
            'branches' => $list,
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            'branches' => [
                [
                    'branch_id' => uniqid('branch_'),
                    'branch_type' => 'if',
                    'next_nodes' => [],
                    'parameters' => ComponentFactory::generateTemplate(StructureType::Condition),
                ],
                [
                    'branch_id' => uniqid('branch_'),
                    'branch_type' => 'else',
                    'next_nodes' => [],
                    'parameters' => null,
                ],
            ],
        ]);
        $this->node->setInput(null);
        $this->node->setOutput(null);
    }
}
