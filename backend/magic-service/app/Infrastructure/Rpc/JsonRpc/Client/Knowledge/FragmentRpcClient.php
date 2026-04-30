<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\JsonRpc\Client\Knowledge;

use App\Application\KnowledgeBase\DTO\FragmentRequestDTO;
use App\Application\KnowledgeBase\DTO\RpcHttpPassthroughResult;
use App\Application\KnowledgeBase\Port\FragmentHttpPassthroughPort;
use App\Domain\KnowledgeBase\Port\FragmentGateway;
use App\Infrastructure\Rpc\Annotation\RpcClient;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Client\AbstractRpcClient;
use App\Infrastructure\Rpc\Method\SvcMethods;
use JsonException;

/**
 * IPC 切片客户端实现.
 *
 * 通过 IPC 调用 Go Engine 处理切片管理相关操作
 */
#[RpcClient(name: SvcMethods::SERVICE_KNOWLEDGE_FRAGMENT)]
class FragmentRpcClient extends AbstractRpcClient implements FragmentGateway, FragmentHttpPassthroughPort
{
    /**
     * 创建切片.
     */
    #[RpcMethod(name: SvcMethods::METHOD_CREATE)]
    public function create(FragmentRequestDTO $request): array
    {
        return $this->callRpc(__FUNCTION__, $this->buildCreateParams($request, true));
    }

    /**
     * flow/teamshare runtime 创建切片并同步写向量.
     */
    #[RpcMethod(name: SvcMethods::METHOD_RUNTIME_CREATE)]
    public function runtimeCreate(FragmentRequestDTO $request): array
    {
        return $this->callRpc(__FUNCTION__, $this->buildCreateParams($request, false));
    }

    /**
     * 获取切片详情.
     */
    #[RpcMethod(name: SvcMethods::METHOD_SHOW)]
    public function show(FragmentRequestDTO $request): array
    {
        $params = [
            'id' => (int) $request->id,
            'knowledge_code' => (string) $request->knowledgeCode,
            'document_code' => (string) $request->documentCode,
            'data_isolation' => $request->dataIsolation->toArray(),
        ];
        return $this->callRpc(__FUNCTION__, $params);
    }

    /**
     * 获取切片列表.
     */
    #[RpcMethod(name: SvcMethods::METHOD_QUERIES)]
    public function list(FragmentRequestDTO $request): array
    {
        return $this->listCall($request, __FUNCTION__);
    }

    /**
     * 删除切片.
     */
    #[RpcMethod(name: SvcMethods::METHOD_DESTROY)]
    public function destroy(FragmentRequestDTO $request): bool
    {
        $params = [
            'id' => (int) $request->id,
            'knowledge_code' => (string) $request->knowledgeCode,
            'document_code' => (string) $request->documentCode,
            'data_isolation' => $request->dataIsolation->toArray(),
        ];
        $this->callRpc(__FUNCTION__, $params);
        return true;
    }

    /**
     * flow/teamshare runtime 按 business_id 删除切片.
     */
    #[RpcMethod(name: SvcMethods::METHOD_RUNTIME_DESTROY_BY_BUSINESS_ID)]
    public function runtimeDestroyByBusinessId(FragmentRequestDTO $request): bool
    {
        $this->callRpc(__FUNCTION__, [
            'knowledge_code' => (string) $request->knowledgeCode,
            'business_id' => $request->businessId,
            'data_isolation' => $request->dataIsolation->toArray(),
        ]);
        return true;
    }

    /**
     * flow/teamshare runtime 按 metadata filter 删除切片.
     */
    #[RpcMethod(name: SvcMethods::METHOD_RUNTIME_DESTROY_BY_METADATA_FILTER)]
    public function runtimeDestroyByMetadataFilter(FragmentRequestDTO $request): bool
    {
        $this->callRpc(__FUNCTION__, [
            'knowledge_code' => (string) $request->knowledgeCode,
            'metadata_filter' => $this->normalizeObjectPayload($request->metadataFilter),
            'data_isolation' => $request->dataIsolation->toArray(),
        ]);
        return true;
    }

    /**
     * 同步切片（触发嵌入计算）.
     */
    #[RpcMethod(name: SvcMethods::METHOD_SYNC)]
    public function sync(FragmentRequestDTO $request): array
    {
        return $this->callRpc(__FUNCTION__, [
            'fragment_id' => (int) $request->id,
            'knowledge_code' => (string) $request->knowledgeCode,
            'data_isolation' => $request->dataIsolation->toArray(),
            'business_params' => $request->businessParams?->toArray() ?? [],
        ]);
    }

    /**
     * 相似度搜索.
     */
    #[RpcMethod(name: SvcMethods::METHOD_SIMILARITY)]
    public function similarity(FragmentRequestDTO $request): array
    {
        return $this->callRpc(__FUNCTION__, $this->buildSimilarityParams($request, false));
    }

    /**
     * flow/teamshare runtime 多知识库相似度搜索.
     */
    #[RpcMethod(name: SvcMethods::METHOD_RUNTIME_SIMILARITY)]
    public function runtimeSimilarity(FragmentRequestDTO $request): array
    {
        $params = [
            'data_isolation' => $request->dataIsolation->toArray(),
            'knowledge_codes' => array_values(array_map('strval', $request->knowledgeCodes)),
            'query' => $request->queryText,
            'question' => $request->question,
            'top_k' => $request->topK,
            'metadata_filter' => $this->normalizeObjectPayload($request->metadataFilter),
            'debug' => $request->debug,
            'business_params' => $request->businessParams?->toArray() ?? [],
        ];
        if ($request->scoreThreshold !== null) {
            $params['score_threshold'] = $request->scoreThreshold;
        }
        return $this->callRpc(__FUNCTION__, $params);
    }

    /**
     * 数字员工维度相似度搜索.
     */
    #[RpcMethod(name: SvcMethods::METHOD_SIMILARITY_BY_AGENT)]
    public function similarityByAgent(FragmentRequestDTO $request): array
    {
        return $this->callRpc(__FUNCTION__, [
            'data_isolation' => $request->dataIsolation->toArray(),
            'agent_code' => (string) $request->agentCode,
            'query' => $request->queryText,
        ]);
    }

    /**
     * 预览切片.
     */
    #[RpcMethod(name: SvcMethods::METHOD_PREVIEW)]
    public function preview(FragmentRequestDTO $request): array
    {
        return $this->callRpc(__FUNCTION__, $this->buildPreviewParams($request, false));
    }

    #[RpcMethod(name: SvcMethods::METHOD_QUERIES_HTTP)]
    public function listPassthrough(FragmentRequestDTO $request): RpcHttpPassthroughResult
    {
        return $this->callRpcPassthrough(__FUNCTION__, $this->buildListParams($request, true));
    }

    #[RpcMethod(name: SvcMethods::METHOD_SIMILARITY_HTTP)]
    public function similarityPassthrough(FragmentRequestDTO $request): RpcHttpPassthroughResult
    {
        return $this->callRpcPassthrough(__FUNCTION__, $this->buildSimilarityParams($request, true));
    }

    #[RpcMethod(name: SvcMethods::METHOD_PREVIEW_HTTP)]
    public function previewPassthrough(FragmentRequestDTO $request): RpcHttpPassthroughResult
    {
        return $this->callRpcPassthrough(__FUNCTION__, $this->buildPreviewParams($request, true));
    }

    /**
     * @return array<string, mixed>
     */
    private function buildPreviewParams(FragmentRequestDTO $request, bool $includeAcceptEncoding): array
    {
        $params = [
            'document_file' => $request->documentFile === [] ? null : $request->documentFile,
            'strategy_config' => $request->strategyConfig,
            'fragment_config' => $request->fragmentConfig,
            'data_isolation' => $request->dataIsolation->toArray(),
        ];
        if ($request->documentCode !== null && $request->documentCode !== '') {
            $params['document_code'] = $request->documentCode;
        }

        if ($includeAcceptEncoding) {
            $params['accept_encoding'] = $request->acceptEncoding;
        }

        return $params;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildCreateParams(FragmentRequestDTO $request, bool $includeFileId): array
    {
        $data = $request->payload;
        $params = [
            'data_isolation' => $request->dataIsolation->toArray(),
            'business_params' => $request->businessParams?->toArray() ?? [],
            'knowledge_code' => (string) ($data['knowledge_code'] ?? ''),
            'document_code' => (string) ($data['document_code'] ?? ''),
        ];
        $this->copyIfKeyExists($params, $data, 'content', transform: static fn ($value) => (string) $value);
        if (array_key_exists('metadata', $data)) {
            $params['metadata'] = $this->normalizeMetadata($data['metadata']);
        }
        $this->copyIfKeyExists($params, $data, 'business_id', transform: static fn ($value) => (string) $value);
        if ($includeFileId) {
            $this->copyIfKeyExists($params, $data, 'file_id', transform: static fn ($value) => (string) $value);
        }
        $this->copyIfKeyExists($params, $data, 'id');

        return $params;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildListParams(FragmentRequestDTO $request, bool $includeAcceptEncoding): array
    {
        $params = $this->listCallParams($request);
        if ($includeAcceptEncoding) {
            $params['accept_encoding'] = $request->acceptEncoding;
        }

        return $params;
    }

    private function listCall(FragmentRequestDTO $request, string $method): array
    {
        return $this->callRpc($method, $this->listCallParams($request));
    }

    /**
     * @return array<string, mixed>
     */
    private function listCallParams(FragmentRequestDTO $request): array
    {
        $query = $request->query;
        $params = [
            'data_isolation' => $request->dataIsolation->toArray(),
            'knowledge_code' => $query['knowledge_code'] ?? '',
            'document_code' => $query['document_code'] ?? '',
        ];
        foreach (['content', 'sync_status', 'version', 'page', 'page_size', 'offset', 'limit'] as $field) {
            if (array_key_exists($field, $query)) {
                $params[$field] = $query[$field];
            }
        }
        return $params;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildSimilarityParams(FragmentRequestDTO $request, bool $includeAcceptEncoding): array
    {
        $params = [
            'data_isolation' => $request->dataIsolation->toArray(),
            'knowledge_code' => (string) $request->knowledgeCode,
            'query' => $request->queryText,
            'top_k' => $request->topK,
            'debug' => $request->debug,
            'business_params' => $request->businessParams?->toArray() ?? [],
        ];
        if ($request->scoreThreshold !== null) {
            $params['score_threshold'] = $request->scoreThreshold;
        }
        if ($includeAcceptEncoding) {
            $params['accept_encoding'] = $request->acceptEncoding;
        }

        return $params;
    }

    /**
     * @return array<string, mixed>|object
     */
    private function normalizeMetadata(mixed $metadata): array|object
    {
        if (is_array($metadata)) {
            return $this->normalizeMetadataArray($metadata);
        }

        if (is_string($metadata) && $metadata !== '') {
            try {
                $decoded = json_decode($metadata, true, 512, JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                return (object) [];
            }

            if (is_array($decoded)) {
                return $this->normalizeMetadataArray($decoded);
            }
        }

        return (object) [];
    }

    /**
     * @param array<string, mixed> $metadata
     * @return array<string, mixed>|object
     */
    private function normalizeMetadataArray(array $metadata): array|object
    {
        if ($metadata === []) {
            return (object) [];
        }

        return $metadata;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>|object
     */
    private function normalizeObjectPayload(array $payload): array|object
    {
        return $this->normalizeMetadataArray($payload);
    }
}
