<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\DTO;

readonly class FragmentRequestDTO
{
    public function __construct(
        public DataIsolationDTO $dataIsolation,
        public ?int $id = null,
        public ?string $knowledgeCode = null,
        public ?string $documentCode = null,
        public ?string $agentCode = null,
        public string $queryText = '',
        public int $topK = 0,
        public ?float $scoreThreshold = null,
        public array $payload = [],
        public array $query = [],
        public array $documentFile = [],
        public array $strategyConfig = [],
        public array $fragmentConfig = [],
        public mixed $debug = false,
        public ?BusinessParamsDTO $businessParams = null,
        public array $knowledgeCodes = [],
        public string $question = '',
        public array $metadataFilter = [],
        public string $businessId = '',
        public string $acceptEncoding = '',
    ) {
    }

    public static function forCreate(array $payload, DataIsolationDTO $dataIsolation, BusinessParamsDTO $businessParams): self
    {
        return new self(dataIsolation: $dataIsolation, payload: $payload, businessParams: $businessParams);
    }

    public static function forShow(
        int $id,
        string $knowledgeCode,
        string $documentCode,
        DataIsolationDTO $dataIsolation,
    ): self {
        return new self(dataIsolation: $dataIsolation, id: $id, knowledgeCode: $knowledgeCode, documentCode: $documentCode);
    }

    public static function forList(array $query, DataIsolationDTO $dataIsolation): self
    {
        return new self(dataIsolation: $dataIsolation, query: $query);
    }

    public static function forDestroy(
        int $id,
        string $knowledgeCode,
        string $documentCode,
        DataIsolationDTO $dataIsolation,
    ): self {
        return new self(
            dataIsolation: $dataIsolation,
            id: $id,
            knowledgeCode: $knowledgeCode,
            documentCode: $documentCode,
        );
    }

    public static function forSimilarity(
        string $knowledgeCode,
        string $queryText,
        int $topK,
        float $scoreThreshold,
        DataIsolationDTO $dataIsolation,
        mixed $debug,
        BusinessParamsDTO $businessParams,
    ): self {
        return new self(
            dataIsolation: $dataIsolation,
            knowledgeCode: $knowledgeCode,
            queryText: $queryText,
            topK: $topK,
            scoreThreshold: $scoreThreshold,
            debug: $debug,
            businessParams: $businessParams,
        );
    }

    public static function forRuntimeSimilarity(
        array $knowledgeCodes,
        string $queryText,
        string $question,
        int $topK,
        ?float $scoreThreshold,
        array $metadataFilter,
        DataIsolationDTO $dataIsolation,
        mixed $debug,
        BusinessParamsDTO $businessParams,
    ): self {
        return new self(
            dataIsolation: $dataIsolation,
            queryText: $queryText,
            topK: $topK,
            scoreThreshold: $scoreThreshold,
            debug: $debug,
            businessParams: $businessParams,
            knowledgeCodes: $knowledgeCodes,
            question: $question,
            metadataFilter: $metadataFilter,
        );
    }

    public static function forRuntimeCreate(
        array $payload,
        DataIsolationDTO $dataIsolation,
        BusinessParamsDTO $businessParams
    ): self {
        return new self(dataIsolation: $dataIsolation, payload: $payload, businessParams: $businessParams);
    }

    public static function forRuntimeDestroyByBusinessId(
        string $knowledgeCode,
        string $businessId,
        DataIsolationDTO $dataIsolation,
    ): self {
        return new self(
            dataIsolation: $dataIsolation,
            knowledgeCode: $knowledgeCode,
            businessId: $businessId,
        );
    }

    public static function forRuntimeDestroyByMetadataFilter(
        string $knowledgeCode,
        array $metadataFilter,
        DataIsolationDTO $dataIsolation,
    ): self {
        return new self(
            dataIsolation: $dataIsolation,
            knowledgeCode: $knowledgeCode,
            metadataFilter: $metadataFilter,
        );
    }

    public static function forPreview(
        array $documentFile,
        array $strategyConfig,
        array $fragmentConfig,
        DataIsolationDTO $dataIsolation,
        ?string $documentCode = null,
    ): self {
        return new self(
            dataIsolation: $dataIsolation,
            documentCode: $documentCode,
            documentFile: $documentFile,
            strategyConfig: $strategyConfig,
            fragmentConfig: $fragmentConfig
        );
    }

    public static function forListPassthrough(array $query, DataIsolationDTO $dataIsolation, string $acceptEncoding): self
    {
        return new self(
            dataIsolation: $dataIsolation,
            query: $query,
            acceptEncoding: $acceptEncoding,
        );
    }

    public static function forPreviewPassthrough(
        array $documentFile,
        array $strategyConfig,
        array $fragmentConfig,
        DataIsolationDTO $dataIsolation,
        string $acceptEncoding,
        ?string $documentCode = null,
    ): self {
        return new self(
            dataIsolation: $dataIsolation,
            documentCode: $documentCode,
            documentFile: $documentFile,
            strategyConfig: $strategyConfig,
            fragmentConfig: $fragmentConfig,
            acceptEncoding: $acceptEncoding,
        );
    }

    public static function forSimilarityPassthrough(
        string $knowledgeCode,
        string $queryText,
        int $topK,
        float $scoreThreshold,
        DataIsolationDTO $dataIsolation,
        mixed $debug,
        BusinessParamsDTO $businessParams,
        string $acceptEncoding,
    ): self {
        return new self(
            dataIsolation: $dataIsolation,
            knowledgeCode: $knowledgeCode,
            queryText: $queryText,
            topK: $topK,
            scoreThreshold: $scoreThreshold,
            debug: $debug,
            businessParams: $businessParams,
            acceptEncoding: $acceptEncoding,
        );
    }

    public static function forAgentSimilarity(
        string $agentCode,
        string $queryText,
        DataIsolationDTO $dataIsolation
    ): self {
        return new self(
            dataIsolation: $dataIsolation,
            agentCode: $agentCode,
            queryText: $queryText,
        );
    }
}
