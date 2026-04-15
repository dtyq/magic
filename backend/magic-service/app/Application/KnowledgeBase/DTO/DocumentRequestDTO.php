<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\DTO;

readonly class DocumentRequestDTO
{
    public function __construct(
        public DataIsolationDTO $dataIsolation,
        public ?string $code = null,
        public ?string $knowledgeBaseCode = null,
        public ?string $thirdPlatformType = null,
        public ?string $thirdFileId = null,
        public ?string $thirdKnowledgeId = null,
        public string $mode = '',
        public array $payload = [],
        public array $query = [],
        public array $documentFile = [],
        public array $fragmentConfig = [],
        public ?BusinessParamsDTO $businessParams = null,
        public ?bool $sync = null,
    ) {
    }

    public static function forCreate(array $payload, DataIsolationDTO $dataIsolation): self
    {
        return new self(dataIsolation: $dataIsolation, payload: $payload);
    }

    public static function forUpdate(
        string $code,
        array $payload,
        DataIsolationDTO $dataIsolation,
        ?string $knowledgeBaseCode = null
    ): self {
        return new self(
            dataIsolation: $dataIsolation,
            code: $code,
            knowledgeBaseCode: $knowledgeBaseCode,
            payload: $payload
        );
    }

    public static function forShow(
        string $code,
        string $knowledgeBaseCode,
        DataIsolationDTO $dataIsolation,
    ): self {
        return new self(dataIsolation: $dataIsolation, code: $code, knowledgeBaseCode: $knowledgeBaseCode);
    }

    public static function forOriginalFileLink(
        string $code,
        string $knowledgeBaseCode,
        DataIsolationDTO $dataIsolation,
    ): self {
        return new self(dataIsolation: $dataIsolation, code: $code, knowledgeBaseCode: $knowledgeBaseCode);
    }

    public static function forList(array $query, DataIsolationDTO $dataIsolation): self
    {
        return new self(dataIsolation: $dataIsolation, query: $query);
    }

    public static function forGetByThirdFileId(
        string $thirdPlatformType,
        string $thirdFileId,
        DataIsolationDTO $dataIsolation,
        ?string $knowledgeBaseCode = null,
    ): self {
        return new self(
            dataIsolation: $dataIsolation,
            knowledgeBaseCode: $knowledgeBaseCode,
            thirdPlatformType: $thirdPlatformType,
            thirdFileId: $thirdFileId,
        );
    }

    public static function forDestroy(
        string $code,
        string $knowledgeBaseCode,
        DataIsolationDTO $dataIsolation,
    ): self {
        return new self(dataIsolation: $dataIsolation, code: $code, knowledgeBaseCode: $knowledgeBaseCode);
    }

    public static function forSync(
        string $code,
        string $knowledgeBaseCode,
        string $mode,
        DataIsolationDTO $dataIsolation,
        BusinessParamsDTO $businessParams,
        ?bool $sync = null,
    ): self {
        return new self(
            dataIsolation: $dataIsolation,
            code: $code,
            knowledgeBaseCode: $knowledgeBaseCode,
            mode: $mode,
            businessParams: $businessParams,
            sync: $sync,
        );
    }

    public static function forReVectorizedByThirdFileId(
        string $thirdPlatformType,
        string $thirdFileId,
        DataIsolationDTO $dataIsolation,
        ?string $thirdKnowledgeId = null,
    ): self {
        return new self(
            dataIsolation: $dataIsolation,
            thirdPlatformType: $thirdPlatformType,
            thirdFileId: $thirdFileId,
            thirdKnowledgeId: $thirdKnowledgeId,
        );
    }
}
