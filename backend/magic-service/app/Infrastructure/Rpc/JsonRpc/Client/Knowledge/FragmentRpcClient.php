<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\JsonRpc\Client\Knowledge;

use App\Application\KnowledgeBase\DTO\FragmentRequestDTO;
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
class FragmentRpcClient extends AbstractRpcClient implements FragmentGateway
{
    /**
     * 创建切片.
     */
    #[RpcMethod(name: SvcMethods::METHOD_CREATE)]
    public function create(FragmentRequestDTO $request): array
    {
        $data = $request->payload;
        $params = [
            'data_isolation' => $request->dataIsolation->toArray(),
            'business_params' => $request->businessParams?->toArray() ?? [],
            'knowledge_code' => (string) ($data['knowledge_code'] ?? ''),
            'document_code' => (string) ($data['document_code'] ?? ''),
            // 兼容旧 Go/PHP 协议
            'organization_code' => (string) ($data['organization_code'] ?? ($request->dataIsolation->organizationCode ?? '')),
            'created_uid' => (string) ($data['created_uid'] ?? ($request->dataIsolation->userId ?? '')),
        ];
        $this->copyIfKeyExists($params, $data, 'content', transform: static fn ($value) => (string) $value);
        if (array_key_exists('metadata', $data)) {
            $params['metadata'] = $this->normalizeMetadata($data['metadata']);
        }
        $this->copyIfKeyExists($params, $data, 'business_id', transform: static fn ($value) => (string) $value);
        $this->copyIfKeyExists($params, $data, 'file_id', transform: static fn ($value) => (string) $value);
        $this->copyIfKeyExists($params, $data, 'id', transform: static fn ($value) => (int) $value);

        return $this->callRpc(__FUNCTION__, $params);
    }

    /**
     * flow/teamshare runtime 创建切片并同步写向量.
     */
    #[RpcMethod(name: SvcMethods::METHOD_RUNTIME_CREATE)]
    public function runtimeCreate(FragmentRequestDTO $request): array
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
        $this->copyIfKeyExists($params, $data, 'id', transform: static fn ($value) => (int) $value);

        return $this->callRpc(__FUNCTION__, $params);
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
            // 兼容旧 Go/PHP 协议
            'id' => (int) $request->id,
        ]);
    }

    /**
     * 相似度搜索.
     */
    #[RpcMethod(name: SvcMethods::METHOD_SIMILARITY)]
    public function similarity(FragmentRequestDTO $request): array
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
        return $this->callRpc(__FUNCTION__, $params);
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
        $documentFile = $this->normalizeDocumentFile($request->documentFile);
        return $this->callRpc(__FUNCTION__, [
            'document_file' => $documentFile === [] ? null : $documentFile,
            'strategy_config' => $request->strategyConfig,
            'fragment_config' => $request->fragmentConfig,
            'data_isolation' => $request->dataIsolation->toArray(),
        ]);
    }

    private function listCall(FragmentRequestDTO $request, string $method): array
    {
        $query = $request->query;
        ['offset' => $normalizedOffset, 'limit' => $normalizedLimit] = $this->resolvePagination($query);
        $params = [
            'data_isolation' => $request->dataIsolation->toArray(),
            'knowledge_code' => $query['knowledge_code'] ?? '',
            'document_code' => $query['document_code'] ?? '',
            'page' => [
                'offset' => $normalizedOffset,
                'limit' => $normalizedLimit,
            ],
            'offset' => $normalizedOffset,
            'limit' => $normalizedLimit,
        ];
        if (array_key_exists('content', $query)) {
            $params['content'] = (string) $query['content'];
        }
        if (array_key_exists('sync_status', $query)) {
            $params['sync_status'] = $query['sync_status'] === null ? null : (int) $query['sync_status'];
        }
        return $this->callRpc($method, $params);
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
     * @param array<string, mixed> $documentFile
     * @return array<string, mixed>
     */
    private function normalizeDocumentFile(array $documentFile): array
    {
        if ($documentFile === []) {
            return [];
        }

        return [
            'type' => $this->normalizeDocumentFileType($documentFile['type'] ?? null),
            'name' => (string) ($documentFile['name'] ?? ''),
            'url' => (string) ($documentFile['url'] ?? ($documentFile['file_link']['url'] ?? $documentFile['key'] ?? '')),
            'size' => (int) ($documentFile['size'] ?? 0),
            'extension' => (string) ($documentFile['extension'] ?? ($documentFile['third_file_extension_name'] ?? '')),
            'third_id' => (string) ($documentFile['third_id'] ?? ($documentFile['third_file_id'] ?? '')),
            'source_type' => (string) ($documentFile['source_type'] ?? ($documentFile['platform_type'] ?? '')),
            'third_file_id' => (string) ($documentFile['third_file_id'] ?? ''),
            'platform_type' => (string) ($documentFile['platform_type'] ?? ''),
            'doc_type' => isset($documentFile['doc_type']) ? (int) $documentFile['doc_type'] : null,
            'key' => (string) ($documentFile['key'] ?? ''),
            'file_link' => $documentFile['file_link'] ?? null,
            'third_file_type' => (string) ($documentFile['third_file_type'] ?? ''),
            'third_file_extension_name' => (string) ($documentFile['third_file_extension_name'] ?? ''),
            'knowledge_base_id' => (string) ($documentFile['knowledge_base_id'] ?? ''),
        ];
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

    private function normalizeDocumentFileType(mixed $typeRaw): string
    {
        if (is_string($typeRaw) && ! is_numeric($typeRaw)) {
            return $typeRaw;
        }

        if (is_int($typeRaw)) {
            return match ($typeRaw) {
                1 => 'external',
                2 => 'third_platform',
                default => '',
            };
        }

        if (is_numeric($typeRaw)) {
            return match ((int) $typeRaw) {
                1 => 'external',
                2 => 'third_platform',
                default => '',
            };
        }

        return '';
    }

    /**
     * @param array<string, mixed> $query
     * @return array{offset: int, limit: int}
     */
    private function resolvePagination(array $query): array
    {
        $limit = max(1, (int) ($query['limit'] ?? $query['page_size'] ?? 10));
        $page = max(1, (int) ($query['page'] ?? 1));
        $offset = (int) ($query['offset'] ?? (($page - 1) * $limit));

        return [
            'offset' => max(0, $offset),
            'limit' => $limit,
        ];
    }
}
