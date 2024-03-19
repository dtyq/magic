<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\VectorDatabase\Similarity;

use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\AbstractValueObject;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class KnowledgeSimilarityFilter extends AbstractValueObject
{
    public array $knowledgeCodes = [];

    public string $query = '';

    public array $metadataFilter = [];

    public int $limit = 5;

    public float $score = 0.4;

    public string $question = '';

    public function validate(): void
    {
        if (empty($this->knowledgeCodes)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'knowledgeCodes']);
        }
        if ($this->query === '' && $this->question == '') {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'query']);
        }
    }

    public function getKnowledgeCodes(): array
    {
        return $this->knowledgeCodes;
    }

    public function setKnowledgeCodes(array $knowledgeCodes): void
    {
        $this->knowledgeCodes = $knowledgeCodes;
    }

    public function getQuery(): string
    {
        return $this->query;
    }

    public function setQuery(string $query): void
    {
        $this->query = $query;
    }

    public function getMetadataFilter(): array
    {
        return $this->metadataFilter;
    }

    public function setMetadataFilter(array $metadataFilter): void
    {
        $this->metadataFilter = $metadataFilter;
    }

    public function getLimit(): int
    {
        return $this->limit;
    }

    public function setLimit(int $limit): void
    {
        $this->limit = $limit;
    }

    public function getScore(): float
    {
        return $this->score;
    }

    public function setScore(float $score): void
    {
        $this->score = $score;
    }

    public function getQuestion(): string
    {
        return $this->question;
    }

    public function setQuestion(string $question): void
    {
        $this->question = $question;
    }
}
