<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;

class SegmentRule extends AbstractValueObject
{
    protected string $separator;

    protected int $chunkSize;

    protected ?int $chunkOverlap = null;

    public function getSeparator(): string
    {
        return $this->separator;
    }

    public function setSeparator(string $separator): self
    {
        $this->separator = $separator;
        return $this;
    }

    public function getChunkSize(): int
    {
        return $this->chunkSize;
    }

    public function setChunkSize(int $chunkSize): self
    {
        $this->chunkSize = $chunkSize;
        return $this;
    }

    public function getChunkOverlap(): ?int
    {
        return $this->chunkOverlap;
    }

    public function setChunkOverlap(?int $chunkOverlap): self
    {
        $this->chunkOverlap = $chunkOverlap;
        return $this;
    }

    public static function fromArray(array $data): self
    {
        $rule = new self();
        $rule->setSeparator($data['separator']);
        $rule->setChunkSize($data['chunk_size']);
        if (isset($data['chunk_overlap'])) {
            $rule->setChunkOverlap($data['chunk_overlap']);
        }
        return $rule;
    }
}
