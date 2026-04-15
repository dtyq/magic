<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;

class SegmentRule extends AbstractValueObject
{
    protected string $separator = "\n\n";

    protected int $chunkSize = 500;

    protected ?int $chunkOverlap = 50;

    protected string $chunkOverlapUnit = 'absolute';

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

    public function getChunkOverlapUnit(): string
    {
        return $this->chunkOverlapUnit;
    }

    public function setChunkOverlapUnit(?string $chunkOverlapUnit): self
    {
        $normalized = strtolower(trim((string) $chunkOverlapUnit));
        $this->chunkOverlapUnit = $normalized !== '' ? $normalized : 'absolute';
        return $this;
    }

    public static function fromArray(array $data): self
    {
        $rule = new self();
        $rule->setSeparator((string) ($data['separator'] ?? "\n\n"));
        $rule->setChunkSize((int) ($data['chunk_size'] ?? 500));
        if (isset($data['chunk_overlap'])) {
            $rule->setChunkOverlap((int) $data['chunk_overlap']);
        }
        $rule->setChunkOverlapUnit($data['chunk_overlap_unit'] ?? 'absolute');
        return $rule;
    }
}
