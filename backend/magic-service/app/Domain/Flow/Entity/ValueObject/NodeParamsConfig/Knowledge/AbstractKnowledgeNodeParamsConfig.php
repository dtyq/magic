<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Knowledge;

use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use Dtyq\FlowExprEngine\Component;

abstract class AbstractKnowledgeNodeParamsConfig extends NodeParamsConfig
{
    protected string $knowledgeCode = '';

    protected ?Component $vectorDatabaseId = null;

    protected ?Component $metadataFilter = null;

    protected ?Component $businessId = null;

    protected ?Component $metadata = null;

    protected ?Component $content = null;

    public function getKnowledgeCode(): string
    {
        return $this->knowledgeCode;
    }

    public function getVectorDatabaseId(): ?Component
    {
        return $this->vectorDatabaseId;
    }

    public function getMetadataFilter(): ?Component
    {
        return $this->metadataFilter;
    }

    public function getBusinessId(): ?Component
    {
        return $this->businessId;
    }

    public function getMetadata(): ?Component
    {
        return $this->metadata;
    }

    public function getContent(): ?Component
    {
        return $this->content;
    }
}
