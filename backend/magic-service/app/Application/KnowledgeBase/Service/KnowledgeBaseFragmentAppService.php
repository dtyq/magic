<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service;

use App\Application\KnowledgeBase\DTO\FragmentRequestDTO;
use App\Application\KnowledgeBase\DTO\KnowledgeBaseRawContextDTO;
use App\Application\KnowledgeBase\DTO\RpcHttpPassthroughResult;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
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
        $payload['knowledge_code'] = $knowledgeBaseCode;
        $payload['document_code'] = $documentCode;
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
        $this->runtimeDestroyByMetadataFilterByDataIsolation($dataIsolation, $knowledgeBaseCode, $metadataFilter);
    }

    public function queriesRaw(
        Authenticatable $authorization,
        array $query,
        string $knowledgeBaseCode,
        string $documentCode,
        ?Page $page = null,
    ): array {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $rpcQuery = $this->buildFragmentListQuery($query, $knowledgeBaseCode, $documentCode, $page);
        return $this->fragmentAppClient->list(FragmentRequestDTO::forList($rpcQuery, $context->dataIsolation()));
    }

    public function queriesHttpPassthroughRaw(
        Authenticatable $authorization,
        array $query,
        string $knowledgeBaseCode,
        string $documentCode,
        string $acceptEncoding = '',
        ?Page $page = null,
    ): RpcHttpPassthroughResult {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $rpcQuery = $this->buildFragmentListQuery($query, $knowledgeBaseCode, $documentCode, $page);

        return $this->fragmentHttpPassthroughClient->listPassthrough(
            FragmentRequestDTO::forListPassthrough($rpcQuery, $context->dataIsolation(), $acceptEncoding)
        );
    }

    public function fragmentPreviewHttpPassthroughRaw(
        Authenticatable $authorization,
        array $documentFile,
        array $strategyConfig,
        array $fragmentConfig,
        string $acceptEncoding = '',
        string $documentCode = '',
    ): RpcHttpPassthroughResult {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);

        return $this->fragmentHttpPassthroughClient->previewPassthrough(
            FragmentRequestDTO::forPreviewPassthrough(
                $documentFile,
                $strategyConfig,
                $fragmentConfig,
                $context->dataIsolation(),
                $acceptEncoding,
                $documentCode,
            )
        );
    }

    /**
     * @return array<int, array<string, mixed>|KnowledgeBaseFragmentDTO>|array{list?: array<int, array<string, mixed>|KnowledgeBaseFragmentDTO>}
     */
    public function similarityRaw(
        Authenticatable $authenticatable,
        string $knowledgeBaseCode,
        string $query,
        mixed $debug = false,
    ): array {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authenticatable);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
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

    public function similarityHttpPassthroughRaw(
        Authenticatable $authenticatable,
        string $knowledgeBaseCode,
        string $query,
        string $acceptEncoding = '',
        mixed $debug = false,
    ): RpcHttpPassthroughResult {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authenticatable);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);

        return $this->fragmentHttpPassthroughClient->similarityPassthrough(
            FragmentRequestDTO::forSimilarityPassthrough(
                $knowledgeBaseCode,
                $query,
                0,
                0.0,
                $context->dataIsolation(),
                $debug,
                $context->businessParams($knowledgeBaseCode),
                $acceptEncoding,
            )
        );
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

    private function buildFragmentListQuery(
        array $query,
        string $knowledgeBaseCode,
        string $documentCode,
        ?Page $page = null,
    ): array {
        $rpcQuery = [
            'knowledge_code' => $knowledgeBaseCode,
            'document_code' => $documentCode,
        ];
        foreach (['content', 'sync_status', 'version', 'page', 'page_size', 'offset', 'limit'] as $field) {
            if (array_key_exists($field, $query)) {
                $rpcQuery[$field] = $query[$field];
            }
        }
        if ($page === null) {
            return $rpcQuery;
        }
        if (! array_key_exists('page', $rpcQuery) && ! array_key_exists('offset', $rpcQuery)) {
            $rpcQuery['page'] = $page->getPage();
        }
        if (! array_key_exists('page_size', $rpcQuery) && ! array_key_exists('limit', $rpcQuery)) {
            $rpcQuery['page_size'] = $page->getPageNum();
        }

        return $rpcQuery;
    }
}
