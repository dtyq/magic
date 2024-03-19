<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Variable;

use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

class VariableSetNodeParamsConfig extends NodeParamsConfig
{
    public function validate(): array
    {
        $params = $this->node->getParams();

        $variablesComponent = ComponentFactory::fastCreate($params['variables']['form'] ?? []);
        if (! $variablesComponent?->isForm()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'variables']);
        }

        $variables = $variablesComponent->getForm()->getKeyValue(check: true, execExpression: false);
        foreach ($variables as $variableKey => $variableValue) {
            VariableValidate::checkName($variableKey);
        }

        return [
            'variables' => [
                'form' => $variablesComponent->jsonSerialize(),
            ],
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            'variables' => [
                'form' => ComponentFactory::generateTemplate(StructureType::Form)->jsonSerialize(),
                'page' => null,
            ],
        ]);
    }
}
