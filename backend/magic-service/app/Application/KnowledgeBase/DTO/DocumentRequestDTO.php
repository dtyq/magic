<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\DTO;

readonly class DocumentRequestDTO
{
    public const string REVECTORIZE_SOURCE_SINGLE_DOCUMENT_MANUAL = 'single_document_manual';

    public const string REVECTORIZE_SOURCE_THIRD_FILE_BROADCAST = 'third_file_broadcast';

    public const string REVECTORIZE_SOURCE_PROJECT_FILE_NOTIFY = 'project_file_notify';

    public const string REVECTORIZE_SOURCE_TEAMSHARE_KNOWLEDGE_START_VECTOR = 'teamshare_knowledge_start_vector';

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
        public ?string $revectorizeSource = null,
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
        ?string $revectorizeSource = null,
    ): self {
        return new self(
            dataIsolation: $dataIsolation,
            code: $code,
            knowledgeBaseCode: $knowledgeBaseCode,
            mode: $mode,
            businessParams: $businessParams,
            revectorizeSource: $revectorizeSource,
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
