<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\DTO;

readonly class KnowledgeBaseRequestDTO
{
    public function __construct(
        public DataIsolationDTO $dataIsolation,
        public ?string $code = null,
        public array $payload = [],
        public array $query = [],
    ) {
    }

    public static function forCreate(array $payload, DataIsolationDTO $dataIsolation): self
    {
        return new self(dataIsolation: $dataIsolation, payload: $payload);
    }

    public static function forUpdate(string $code, array $payload, DataIsolationDTO $dataIsolation): self
    {
        return new self(dataIsolation: $dataIsolation, code: $code, payload: $payload);
    }

    public static function forSaveProcess(string $code, array $payload, DataIsolationDTO $dataIsolation): self
    {
        return new self(dataIsolation: $dataIsolation, code: $code, payload: $payload);
    }

    public static function forShow(string $code, DataIsolationDTO $dataIsolation): self
    {
        return new self(dataIsolation: $dataIsolation, code: $code);
    }

    public static function forList(array $query, DataIsolationDTO $dataIsolation): self
    {
        return new self(dataIsolation: $dataIsolation, query: $query);
    }

    public static function forNodes(array $query, DataIsolationDTO $dataIsolation): self
    {
        return new self(dataIsolation: $dataIsolation, query: $query);
    }

    public static function forDestroy(string $code, DataIsolationDTO $dataIsolation): self
    {
        return new self(dataIsolation: $dataIsolation, code: $code);
    }

    public static function forRebuild(array $payload, DataIsolationDTO $dataIsolation): self
    {
        return new self(dataIsolation: $dataIsolation, payload: $payload);
    }

    public static function forRepairSourceBindings(array $payload, DataIsolationDTO $dataIsolation): self
    {
        return new self(dataIsolation: $dataIsolation, payload: $payload);
    }

    public static function forRebuildCleanup(array $payload, DataIsolationDTO $dataIsolation): self
    {
        return new self(dataIsolation: $dataIsolation, payload: $payload);
    }
}
