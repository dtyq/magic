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
        $params = [
            'organization_code' => (string) ($data['organization_code'] ?? ''),
            'user_id' => (string) ($data['user_id'] ?? ''),
            'knowledge_base_code' => (string) ($data['knowledge_base_code'] ?? ''),
            'data_isolation' => $request->dataIsolation->toArray(),
        ];
        if (array_key_exists('document_file', $data)) {
            $params['document_file'] = $data['document_file'];
        }
        $this->copyIfKeyExists($params, $data, 'name', transform: static fn ($value) => (string) $value);
        $this->copyIfKeyExists($params, $data, 'description', transform: static fn ($value) => (string) $value);
        $this->copyIfKeyExists($params, $data, 'doc_type');
        $this->copyIfKeyExists($params, $data, 'type');
        $this->copyIfKeyExists($params, $data, 'doc_metadata');
        $this->copyIfKeyExists($params, $data, 'metadata');
        $this->copyIfKeyExists($params, $data, 'strategy_config');
        $this->copyIfKeyExists($params, $data, 'third_platform_type', transform: static fn ($value) => (string) $value);
        $this->copyIfKeyExists($params, $data, 'third_file_id', transform: static fn ($value) => (string) $value);
        $this->copyIfKeyExists($params, $data, 'embedding_model', transform: static fn ($value) => (string) $value);
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
        $params = [
            'organization_code' => (string) ($data['organization_code'] ?? ''),
            'user_id' => (string) ($data['user_id'] ?? ''),
            'code' => (string) $request->code,
            'knowledge_base_code' => (string) ($request->knowledgeBaseCode ?? ($data['knowledge_base_code'] ?? '')),
            'data_isolation' => $request->dataIsolation->toArray(),
        ];
        $this->copyIfKeyExists($params, $data, 'name', transform: static fn ($value) => (string) $value);
        $this->copyIfKeyExists($params, $data, 'description', transform: static fn ($value) => (string) $value);
        $this->copyIfKeyExists($params, $data, 'enabled');
        $this->copyIfKeyExists($params, $data, 'status');
        if (array_key_exists('document_file', $data)) {
            $params['document_file'] = $data['document_file'];
        }
        $this->copyIfKeyExists($params, $data, 'doc_type');
        $this->copyIfKeyExists($params, $data, 'type');
        $this->copyIfKeyExists($params, $data, 'doc_metadata');
        $this->copyIfKeyExists($params, $data, 'metadata');
        $this->copyIfKeyExists($params, $data, 'strategy_config');
        $this->copyIfKeyExists($params, $data, 'retrieve_config');
        $this->copyIfKeyExists($params, $data, 'fragment_config');
        $this->copyIfKeyExists($params, $data, 'word_count');

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
        $params = [
            'organization_code' => (string) ($query['organization_code'] ?? ''),
            'knowledge_base_code' => (string) ($query['knowledge_base_code'] ?? ''),
            'data_isolation' => $request->dataIsolation->toArray(),
        ];
        foreach (['name', 'doc_type', 'type', 'enabled', 'status', 'sync_status', 'page', 'page_size', 'offset', 'limit'] as $field) {
            if (array_key_exists($field, $query)) {
                $params[$field] = $query[$field];
            }
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
        ];
        if ($request->revectorizeSource !== null && $request->revectorizeSource !== '') {
            $params['revectorize_source'] = $request->revectorizeSource;
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
}
