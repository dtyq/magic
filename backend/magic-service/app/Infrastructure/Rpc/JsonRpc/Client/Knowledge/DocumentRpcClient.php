<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\JsonRpc\Client\Knowledge;

use App\Application\KnowledgeBase\DTO\DocumentRequestDTO;
use App\Domain\KnowledgeBase\Port\DocumentGateway;
use App\Infrastructure\Rpc\Annotation\RpcClient;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Client\AbstractRpcClient;
use App\Infrastructure\Rpc\Method\SvcMethods;

/**
 * IPC 文档客户端实现.
 *
 * 通过 IPC 调用 Go Engine 处理文档管理相关操作
 */
#[RpcClient(name: SvcMethods::SERVICE_KNOWLEDGE_DOCUMENT)]
class DocumentRpcClient extends AbstractRpcClient implements DocumentGateway
{
    /**
     * 创建文档.
     */
    #[RpcMethod(name: SvcMethods::METHOD_CREATE)]
    public function create(DocumentRequestDTO $request): array
    {
        $data = $request->payload;
        $dataIsolation = $request->dataIsolation->toArray();
        $userId = $dataIsolation['user_id'] ?? '';
        $knowledgeBaseCode = (string) ($data['knowledge_base_code'] ?? ($data['knowledge_code'] ?? ''));
        $params = [
            'organization_code' => $this->resolvePreferredString(
                $data['organization_code'] ?? null,
                $dataIsolation['organization_code'] ?? null,
            ),
            'user_id' => (string) ($data['created_uid'] ?? $userId),
            'knowledge_base_code' => $knowledgeBaseCode,
            // 兼容旧 Go/PHP 协议
            'data_isolation' => $dataIsolation,
            'knowledge_code' => $knowledgeBaseCode,
            'created_uid' => (string) ($data['created_uid'] ?? $userId),
        ];
        $documentFile = [];
        if (array_key_exists('document_file', $data)) {
            $documentFile = $this->normalizeDocumentFile((array) $data['document_file']);
            $params['document_file'] = $documentFile === [] ? null : $documentFile;
        }
        $this->copyIfKeyExists($params, $data, 'name', transform: static fn ($value) => (string) $value);
        $this->copyIfKeyExists($params, $data, 'description', transform: static fn ($value) => (string) $value);
        if ($this->hasAnyKey($data, ['doc_type', 'type'])) {
            $docType = (int) ($data['doc_type'] ?? ($data['type'] ?? 0));
            $params['doc_type'] = $docType;
            $params['type'] = $docType;
        }
        if ($this->hasAnyKey($data, ['doc_metadata', 'metadata'])) {
            $docMetadata = $this->normalizeMetadataPayload($data['doc_metadata'] ?? ($data['metadata'] ?? []));
            $params['doc_metadata'] = $docMetadata;
            $params['metadata'] = $docMetadata;
        }
        $this->copyIfKeyExists($params, $data, 'strategy_config');
        if ($this->hasAnyKey($data, ['third_platform_type']) || $documentFile !== []) {
            $params['third_platform_type'] = (string) ($data['third_platform_type'] ?? ($documentFile['platform_type'] ?? ''));
        }
        if ($this->hasAnyKey($data, ['third_file_id']) || $documentFile !== []) {
            $params['third_file_id'] = (string) ($data['third_file_id'] ?? ($documentFile['third_id'] ?? ''));
        }
        if ($this->hasAnyKey($data, ['embedding_model', 'embedding_config'])) {
            $params['embedding_model'] = (string) ($data['embedding_model'] ?? ($data['embedding_config']['model_id'] ?? ''));
        }
        $this->copyIfKeyExists($params, $data, 'vector_db', transform: static fn ($value) => (string) $value);
        $this->copyIfKeyExists($params, $data, 'retrieve_config');
        $this->copyIfKeyExists($params, $data, 'fragment_config');
        $this->copyIfKeyExists($params, $data, 'embedding_config');
        $this->copyIfKeyExists($params, $data, 'vector_db_config');
        return $this->callRpc(__FUNCTION__, $params);
    }

    /**
     * 更新文档.
     */
    #[RpcMethod(name: SvcMethods::METHOD_UPDATE)]
    public function update(DocumentRequestDTO $request): array
    {
        $data = $request->payload;
        $dataIsolation = $request->dataIsolation->toArray();
        $userId = $dataIsolation['user_id'] ?? '';
        $knowledgeBaseCode = (string) ($request->knowledgeBaseCode ?? ($data['knowledge_base_code'] ?? ($data['knowledge_code'] ?? '')));
        $params = [
            'organization_code' => $this->resolvePreferredString(
                $data['organization_code'] ?? null,
                $dataIsolation['organization_code'] ?? null,
            ),
            'user_id' => (string) ($data['updated_uid'] ?? $userId),
            'code' => (string) $request->code,
            'knowledge_base_code' => $knowledgeBaseCode,
            // 兼容旧 Go/PHP 协议
            'data_isolation' => $dataIsolation,
            'knowledge_code' => $knowledgeBaseCode,
            'updated_uid' => (string) ($data['updated_uid'] ?? $userId),
        ];
        $this->copyIfKeyExists($params, $data, 'name', transform: static fn ($value) => (string) $value);
        $this->copyIfKeyExists($params, $data, 'description', transform: static fn ($value) => (string) $value);
        if ($this->hasAnyKey($data, ['enabled', 'status'])) {
            $params['enabled'] = $this->resolveNullableEnabled($data);
            if (array_key_exists('status', $data)) {
                $params['status'] = $data['status'] === null ? null : (int) $data['status'];
            }
        }
        if (array_key_exists('document_file', $data)) {
            $documentFile = $this->normalizeDocumentFile((array) $data['document_file']);
            $params['document_file'] = $documentFile === [] ? null : $documentFile;
        }
        if ($this->hasAnyKey($data, ['doc_type', 'type'])) {
            $docType = $this->resolveNullableDocType($data);
            $params['doc_type'] = $docType;
        }
        if ($this->hasAnyKey($data, ['doc_metadata', 'metadata'])) {
            $docMetadata = $this->normalizeMetadataPayload($data['doc_metadata'] ?? ($data['metadata'] ?? []));
            $params['doc_metadata'] = $docMetadata;
            $params['metadata'] = $docMetadata;
        }
        $this->copyIfKeyExists($params, $data, 'strategy_config');
        $this->copyIfKeyExists($params, $data, 'retrieve_config');
        $this->copyIfKeyExists($params, $data, 'fragment_config');
        $this->copyIfKeyExists($params, $data, 'word_count', transform: static fn ($value) => $value === null ? null : (int) $value);

        return $this->callRpc(__FUNCTION__, $params);
    }

    /**
     * 获取文档详情.
     */
    #[RpcMethod(name: SvcMethods::METHOD_SHOW)]
    public function show(DocumentRequestDTO $request): array
    {
        $params = [
            'code' => (string) $request->code,
            'knowledge_base_code' => (string) $request->knowledgeBaseCode,
            'data_isolation' => $request->dataIsolation->toArray(),
        ];
        return $this->callRpc(__FUNCTION__, $params);
    }

    /**
     * 获取文档原始文件访问链接.
     */
    #[RpcMethod(name: SvcMethods::METHOD_GET_ORIGINAL_FILE_LINK)]
    public function getOriginalFileLink(DocumentRequestDTO $request): array
    {
        $params = [
            'code' => (string) $request->code,
            'knowledge_base_code' => (string) $request->knowledgeBaseCode,
            'data_isolation' => $request->dataIsolation->toArray(),
        ];
        return $this->callRpc(__FUNCTION__, $params);
    }

    /**
     * 获取文档列表.
     */
    #[RpcMethod(name: SvcMethods::METHOD_QUERIES)]
    public function list(DocumentRequestDTO $request): array
    {
        $query = $request->query;
        ['limit' => $limit, 'offset' => $offset] = $this->resolvePageWindow($query);
        $knowledgeBaseCode = (string) ($query['knowledge_base_code'] ?? ($query['knowledge_code'] ?? ''));
        $params = [
            'organization_code' => (string) ($query['organization_code'] ?? $request->dataIsolation->organizationCode),
            'knowledge_base_code' => $knowledgeBaseCode,
            'page' => [
                'offset' => $offset,
                'limit' => $limit,
            ],
            // 兼容旧 Go/PHP 协议
            'data_isolation' => $request->dataIsolation->toArray(),
            'knowledge_code' => $knowledgeBaseCode,
            'offset' => $offset,
            'limit' => $limit,
        ];
        if (array_key_exists('name', $query)) {
            $params['name'] = (string) $query['name'];
        }
        if ($this->hasAnyKey($query, ['doc_type', 'type'])) {
            $docType = $this->resolveNullableDocType($query);
            $params['doc_type'] = $docType;
            $params['type'] = $docType;
        }
        if ($this->hasAnyKey($query, ['enabled', 'status'])) {
            $params['enabled'] = $this->resolveNullableEnabled($query);
            if (array_key_exists('status', $query)) {
                $params['status'] = $query['status'] === null ? null : (int) $query['status'];
            }
        }
        if (array_key_exists('sync_status', $query)) {
            $params['sync_status'] = $query['sync_status'] === null ? null : (int) $query['sync_status'];
        }
        return $this->callRpc(__FUNCTION__, $params);
    }

    /**
     * 按第三方文件 ID 获取文档列表.
     */
    #[RpcMethod(name: SvcMethods::METHOD_GET_BY_THIRD_FILE_ID)]
    public function getByThirdFileId(DocumentRequestDTO $request): array
    {
        return $this->callRpc(__FUNCTION__, [
            'data_isolation' => $request->dataIsolation->toArray(),
            'knowledge_base_code' => $request->knowledgeBaseCode ?? '',
            'third_platform_type' => $request->thirdPlatformType ?? '',
            'third_file_id' => $request->thirdFileId ?? '',
        ]);
    }

    /**
     * 删除文档.
     */
    #[RpcMethod(name: SvcMethods::METHOD_DESTROY)]
    public function destroy(DocumentRequestDTO $request): bool
    {
        $params = [
            'code' => (string) $request->code,
            'knowledge_base_code' => (string) $request->knowledgeBaseCode,
            // 兼容旧 Go/PHP 协议
            'knowledge_code' => (string) $request->knowledgeBaseCode,
            'data_isolation' => $request->dataIsolation->toArray(),
        ];
        $this->callRpc(__FUNCTION__, $params);
        return true;
    }

    /**
     * 同步文档（向量化）.
     */
    #[RpcMethod(name: SvcMethods::METHOD_SYNC)]
    public function sync(DocumentRequestDTO $request): bool
    {
        $params = [
            'code' => (string) $request->code,
            'knowledge_base_code' => (string) $request->knowledgeBaseCode,
            'mode' => $request->mode,
            'data_isolation' => $request->dataIsolation->toArray(),
            'business_params' => $request->businessParams?->toArray() ?? [],
            // 兼容旧 Go/PHP 协议
            'knowledge_code' => (string) $request->knowledgeBaseCode,
        ];
        if ($request->sync !== null) {
            $params['sync'] = $request->sync;
        }
        $this->callRpc(__FUNCTION__, $params);
        return true;
    }

    /**
     * 按第三方文件 ID 触发重新向量化.
     */
    #[RpcMethod(name: SvcMethods::METHOD_RE_VECTORIZED_BY_THIRD_FILE_ID)]
    public function reVectorizedByThirdFileId(DocumentRequestDTO $request): bool
    {
        $params = [
            'data_isolation' => $request->dataIsolation->toArray(),
            'third_platform_type' => $request->thirdPlatformType ?? '',
            'third_file_id' => $request->thirdFileId ?? '',
        ];

        if ($request->thirdKnowledgeId !== null && $request->thirdKnowledgeId !== '') {
            $params['third_knowledge_id'] = $request->thirdKnowledgeId;
        }

        $this->callRpc(__FUNCTION__, $params);
        return true;
    }

    /**
     * 批量统计知识库文档数量.
     *
     * @return array<string, int>
     */
    #[RpcMethod(name: SvcMethods::METHOD_COUNT_BY_KNOWLEDGE_BASE_CODES)]
    public function countByKnowledgeBaseCodes(DocumentRequestDTO $request): array
    {
        $result = $this->callRpc(__FUNCTION__, [
            'data_isolation' => $request->dataIsolation->toArray(),
            'knowledge_base_codes' => $request->query['knowledge_base_codes'] ?? [],
        ]);

        $counts = [];
        foreach ($result as $knowledgeBaseCode => $count) {
            $counts[(string) $knowledgeBaseCode] = (int) $count;
        }

        return $counts;
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

        $typeRaw = $documentFile['type'] ?? null;
        $type = is_string($typeRaw) ? $typeRaw : match ($typeRaw) {
            1 => 'external',
            2 => 'third_platform',
            default => '',
        };

        return [
            'type' => $type,
            'name' => (string) ($documentFile['name'] ?? ''),
            'url' => (string) ($documentFile['url'] ?? ($documentFile['file_link']['url'] ?? '')),
            'size' => (int) ($documentFile['size'] ?? 0),
            'extension' => (string) ($documentFile['extension'] ?? ($documentFile['third_file_extension_name'] ?? '')),
            'third_id' => (string) ($documentFile['third_id'] ?? ($documentFile['third_file_id'] ?? '')),
            'source_type' => (string) ($documentFile['source_type'] ?? ($documentFile['platform_type'] ?? '')),
            // 扩展字段：Go 侧当前未全部使用，但保留透传以兼容 enterprise 数据
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
     * @param array<string, mixed> $payload
     */
    private function resolveNullableEnabled(array $payload): ?bool
    {
        foreach (['enabled', 'status'] as $key) {
            if (! array_key_exists($key, $payload)) {
                continue;
            }
            $value = $payload[$key];
            if ($value === null || $value === '') {
                return null;
            }
            return (bool) $value;
        }
        return null;
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function resolveNullableDocType(array $payload): ?int
    {
        if (isset($payload['doc_type'])) {
            return (int) $payload['doc_type'];
        }

        if (isset($payload['type'])) {
            return (int) $payload['type'];
        }

        return null;
    }

    private function resolvePreferredString(mixed ...$values): string
    {
        foreach ($values as $value) {
            if (! is_string($value)) {
                continue;
            }
            $trimmed = trim($value);
            if ($trimmed !== '') {
                return $trimmed;
            }
        }
        return '';
    }
}
