<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service;

use App\Application\KnowledgeBase\DTO\FragmentRequestDTO;
use App\Application\KnowledgeBase\DTO\KnowledgeBaseRawContextDTO;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\OperationAction;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\KnowledgeBase\DTO\KnowledgeBaseFragmentDTO;
use Qbhy\HyperfAuth\Authenticatable;

class KnowledgeBaseFragmentAppService extends AbstractKnowledgeAppService
{
    public function saveRaw(
        Authenticatable $authorization,
        array $payload,
        string $knowledgeBaseCode,
        string $documentCode,
        ?int $id = null,
    ): array {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $this->checkKnowledgeBaseOperation($dataIsolation, OperationAction::Edit->value, $knowledgeBaseCode, $documentCode);
        $payload['knowledge_code'] = $knowledgeBaseCode;
        $payload['document_code'] = $documentCode;
        $payload = $context->withOrganization($payload);
        $payload = $context->withCreatedUid($payload);
        if ($id !== null && $id > 0) {
            $payload['id'] = $id;
        }

        return $this->fragmentAppClient->create(FragmentRequestDTO::forCreate(
            $payload,
            $context->dataIsolation(),
            $context->businessParams($knowledgeBaseCode)
        ));
    }

    public function showRaw(
        Authenticatable $authorization,
        string $knowledgeBaseCode,
        string $documentCode,
        int $id,
    ): array {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $this->checkKnowledgeBaseOperation($dataIsolation, OperationAction::Read->value, $knowledgeBaseCode, $documentCode, $id);
        return $this->fragmentAppClient->show(FragmentRequestDTO::forShow(
            $id,
            $knowledgeBaseCode,
            $documentCode,
            $context->dataIsolation(),
        ));
    }

    public function destroy(
        Authenticatable $authorization,
        string $knowledgeBaseCode,
        string $documentCode,
        int $id,
    ): void {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $this->checkKnowledgeBaseOperation($dataIsolation, OperationAction::Delete->value, $knowledgeBaseCode, $documentCode, $id);
        $this->fragmentAppClient->destroy(FragmentRequestDTO::forDestroy(
            $id,
            $knowledgeBaseCode,
            $documentCode,
            $context->dataIsolation(),
        ));
    }

    public function destroyByMetadataFilter(Authenticatable $authorization, string $knowledgeBaseCode, array $metadataFilter): void
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $this->checkKnowledgeBaseOperation($dataIsolation, OperationAction::Delete->value, $knowledgeBaseCode);
        $this->runtimeDestroyByMetadataFilterByDataIsolation($dataIsolation, $knowledgeBaseCode, $metadataFilter);
    }

    public function queriesRaw(
        Authenticatable $authorization,
        array $query,
        string $knowledgeBaseCode,
        string $documentCode,
        Page $page,
    ): array {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $this->checkKnowledgeBaseOperation($dataIsolation, OperationAction::Read->value, $knowledgeBaseCode, $documentCode);

        $rpcQuery = [
            'knowledge_code' => $knowledgeBaseCode,
            'document_code' => $documentCode,
            'page' => $page->getPage(),
            'page_size' => $page->getPageNum(),
            'offset' => $page->getSliceStart(),
            'limit' => $page->getPageNum(),
        ];
        foreach (['content', 'sync_status'] as $field) {
            if (array_key_exists($field, $query)) {
                $rpcQuery[$field] = $query[$field];
            }
        }
        return $this->fragmentAppClient->list(FragmentRequestDTO::forList($rpcQuery, $context->dataIsolation()));
    }

    public function fragmentPreviewRaw(
        Authenticatable $authorization,
        array $documentFile,
        array $strategyConfig,
        array $fragmentConfig
    ): array {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        return $this->fragmentAppClient->preview(FragmentRequestDTO::forPreview(
            $documentFile,
            $strategyConfig,
            $fragmentConfig,
            $context->dataIsolation()
        ));
    }

    /**
     * @return array<int, array<string, mixed>|KnowledgeBaseFragmentDTO>|array{list?: array<int, array<string, mixed>|KnowledgeBaseFragmentDTO>}
     */
    public function similarityRaw(
        Authenticatable $authenticatable,
        string $knowledgeBaseCode,
        string $query,
        bool $debug = false,
    ): array {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authenticatable);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $this->checkKnowledgeBaseOperation($dataIsolation, OperationAction::Read->value, $knowledgeBaseCode);
        return $this->fragmentAppClient->similarity(FragmentRequestDTO::forSimilarity(
            $knowledgeBaseCode,
            $query,
            0,
            0.0,
            $context->dataIsolation(),
            $debug,
            $context->businessParams($knowledgeBaseCode),
        ));
    }

    /**
     * @return array<KnowledgeBaseFragmentDTO>
     */
    public function similarity(Authenticatable $authenticatable, string $knowledgeBaseCode, string $query): array
    {
        $result = $this->similarityRaw($authenticatable, $knowledgeBaseCode, $query);
        /** @var array<int, array<string, mixed>|KnowledgeBaseFragmentDTO> $items */
        $items = isset($result['list']) && is_array($result['list']) ? $result['list'] : $result;
        $normalized = [];
        foreach ($items as $item) {
            if ($item instanceof KnowledgeBaseFragmentDTO) {
                $normalized[] = $item;
                continue;
            }
            if (is_array($item)) {
                $normalized[] = new KnowledgeBaseFragmentDTO($item);
            }
        }
        return $normalized;
    }

    public function agentSimilarityRaw(Authenticatable $authenticatable, string $agentCode, string $query): array
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authenticatable);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);

        return $this->fragmentAppClient->similarityByAgent(
            FragmentRequestDTO::forAgentSimilarity(
                $agentCode,
                $query,
                $context->dataIsolation(),
            )
        );
    }

    public function runtimeSimilarityByDataIsolation(
        KnowledgeBaseDataIsolation $dataIsolation,
        array $knowledgeCodes,
        string $query,
        string $question = '',
        int $topK = 0,
        ?float $scoreThreshold = null,
        array $metadataFilter = [],
        bool $debug = false,
    ): array {
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $businessId = (string) ($knowledgeCodes[0] ?? '');

        return $this->fragmentAppClient->runtimeSimilarity(FragmentRequestDTO::forRuntimeSimilarity(
            $knowledgeCodes,
            $query,
            $question,
            $topK,
            $scoreThreshold,
            $metadataFilter,
            $context->dataIsolation(),
            $debug,
            $context->businessParams($businessId),
        ));
    }

    public function runtimeCreateByDataIsolation(
        KnowledgeBaseDataIsolation $dataIsolation,
        string $knowledgeBaseCode,
        string $content,
        array $metadata = [],
        string $businessId = '',
        ?string $documentCode = null,
        ?int $id = null,
    ): array {
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $payload = [
            'knowledge_code' => $knowledgeBaseCode,
            'content' => $content,
            'metadata' => $metadata,
            'business_id' => $businessId,
        ];
        if ($documentCode !== null && $documentCode !== '') {
            $payload['document_code'] = $documentCode;
        }
        if ($id !== null && $id > 0) {
            $payload['id'] = $id;
        }

        return $this->fragmentAppClient->runtimeCreate(FragmentRequestDTO::forRuntimeCreate(
            $payload,
            $context->dataIsolation(),
            $context->businessParams($knowledgeBaseCode),
        ));
    }

    public function runtimeDestroyByBusinessIdByDataIsolation(
        KnowledgeBaseDataIsolation $dataIsolation,
        string $knowledgeBaseCode,
        string $businessId,
    ): void {
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $this->fragmentAppClient->runtimeDestroyByBusinessId(FragmentRequestDTO::forRuntimeDestroyByBusinessId(
            $knowledgeBaseCode,
            $businessId,
            $context->dataIsolation(),
        ));
    }

    public function runtimeDestroyByMetadataFilterByDataIsolation(
        KnowledgeBaseDataIsolation $dataIsolation,
        string $knowledgeBaseCode,
        array $metadataFilter,
    ): void {
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $this->fragmentAppClient->runtimeDestroyByMetadataFilter(FragmentRequestDTO::forRuntimeDestroyByMetadataFilter(
            $knowledgeBaseCode,
            $metadataFilter,
            $context->dataIsolation(),
        ));
    }
}
