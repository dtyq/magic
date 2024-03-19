<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Knowledge;

use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

class KnowledgeFragmentRemoveNodeParamsConfig extends AbstractKnowledgeNodeParamsConfig
{
    public function validate(): array
    {
        $params = $this->node->getParams();

        $this->knowledgeCode = $params['knowledge_code'] ?? '';

        $vectorDatabaseId = ComponentFactory::fastCreate($params['vector_database_id'] ?? []);
        if ($vectorDatabaseId && ! $vectorDatabaseId->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'vector_database_id']);
        }
        $this->vectorDatabaseId = $vectorDatabaseId;

        $metadataFilter = ComponentFactory::fastCreate($params['metadata'] ?? []);
        if ($metadataFilter && ! $metadataFilter->isForm()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'metadata']);
        }
        $this->metadataFilter = $metadataFilter;

        $businessId = ComponentFactory::fastCreate($params['business_id'] ?? []);
        if ($businessId && ! $businessId->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'business_id']);
        }
        $this->businessId = $businessId;

        return [
            'knowledge_code' => $this->knowledgeCode,
            'vector_database_id' => $this->vectorDatabaseId?->toArray(),
            'metadata' => $this->metadataFilter?->toArray(),
            'business_id' => $this->businessId?->toArray(),
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            'knowledge_code' => '',
            'vector_database_id' => ComponentFactory::generateTemplate(StructureType::Value),
            'metadata' => ComponentFactory::generateTemplate(StructureType::Form),
            'business_id' => ComponentFactory::generateTemplate(StructureType::Value),
        ]);
    }
}
