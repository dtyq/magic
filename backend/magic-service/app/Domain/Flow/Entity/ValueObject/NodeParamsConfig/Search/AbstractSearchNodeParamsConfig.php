<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Search;

use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Search\Structure\Filter;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Search\Structure\FilterType;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Search\Structure\LeftType;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Search\Structure\OperatorType;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;

abstract class AbstractSearchNodeParamsConfig extends NodeParamsConfig
{
    private FilterType $filterType;

    /**
     * @var Filter[]
     */
    private array $filters = [];

    public function getFilterType(): FilterType
    {
        return $this->filterType;
    }

    /**
     * @return Filter[]
     */
    public function getFilters(): array
    {
        return $this->filters;
    }

    public function validate(): array
    {
        $params = $this->node->getParams();
        $filterType = FilterType::tryFrom($params['filter_type'] ?? '');
        if (! $filterType) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'common.invalid', ['label' => 'filter_type']);
        }
        $this->filterType = $filterType;

        if (empty($params['filters'])) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'common.empty', ['label' => 'filters']);
        }
        $filters = [];
        foreach ($params['filters'] as $index => $filter) {
            $left = LeftType::tryFrom($filter['left'] ?? '');
            if (! $left) {
                ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'common.invalid', ['label' => 'filters.' . $index . '.left']);
            }
            $operator = OperatorType::tryFrom($filter['operator'] ?? '');
            if (! $operator) {
                ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'common.invalid', ['label' => 'filters.' . $index . '.operator']);
            }
            $right = ComponentFactory::fastCreate($filter['right'] ?? []);
            if (! $right?->isValue()) {
                ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'common.invalid', ['label' => 'filters.' . $index . '.right']);
            }

            $filters[] = new Filter($left, $operator, $right);
        }
        $this->filters = $filters;
        return [
            'filter_type' => $filterType->value,
            'filters' => array_map(fn (Filter $filter) => $filter->toArray(), $filters),
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            'filter_type' => 'all',
            'filters' => [],
        ]);
    }
}
