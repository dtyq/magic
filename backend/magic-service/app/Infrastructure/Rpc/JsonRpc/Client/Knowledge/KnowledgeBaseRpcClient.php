<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\JsonRpc\Client\Knowledge;

use App\Application\KnowledgeBase\DTO\KnowledgeBaseRequestDTO;
use App\Domain\KnowledgeBase\Port\KnowledgeBaseGateway;
use App\Infrastructure\Rpc\Annotation\RpcClient;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Client\AbstractRpcClient;
use App\Infrastructure\Rpc\Method\SvcMethods;

/**
 * IPC 知识库客户端实现.
 *
 * 通过 IPC 调用 Go Engine 处理知识库管理相关操作
 */
#[RpcClient(name: SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE)]
class KnowledgeBaseRpcClient extends AbstractRpcClient implements KnowledgeBaseGateway
{
    /**
     * 创建知识库.
     */
    #[RpcMethod(name: SvcMethods::METHOD_CREATE)]
    public function create(KnowledgeBaseRequestDTO $request): array
    {
        $data = $request->payload;
        $params = [
            'data_isolation' => $request->dataIsolation->toArray(),
        ];

        foreach (['code', 'name', 'description', 'type', 'model', 'vector_db', 'business_id', 'icon', 'source_type'] as $field) {
            $this->copyIfKeyExists($params, $data, $field);
        }
        if (array_key_exists('agent_codes', $data)) {
            $params['agent_codes'] = array_values(array_map('strval', (array) $data['agent_codes']));
        }
        $this->copyKnowledgeBaseConfigParams($params, $data);
        $this->copyIfKeyExists($params, $data, 'source_bindings');
        $this->copyIfKeyExists($params, $data, 'document_files');

        return $this->callRpc(__FUNCTION__, $params);
    }

    /**
     * 更新知识库.
     */
    #[RpcMethod(name: SvcMethods::METHOD_UPDATE)]
    public function update(KnowledgeBaseRequestDTO $request): array
    {
        $data = $request->payload;
        $params = [
            'code' => (string) $request->code,
            'data_isolation' => $request->dataIsolation->toArray(),
        ];
        foreach (['name', 'description', 'enabled', 'status', 'icon', 'source_type'] as $field) {
            $this->copyIfKeyExists($params, $data, $field);
        }
        $this->copyKnowledgeBaseConfigParams($params, $data);
        $this->copyIfKeyExists($params, $data, 'source_bindings');
        $this->copyIfKeyExists($params, $data, 'document_files');

        return $this->callRpc(__FUNCTION__, $params);
    }

    /**
     * 更新知识库向量化进度.
     */
    #[RpcMethod(name: SvcMethods::METHOD_SAVE_PROCESS)]
    public function saveProcess(KnowledgeBaseRequestDTO $request): array
    {
        $data = $request->payload;
        $dataIsolation = $request->dataIsolation->toArray();

        $params = [
            'code' => (string) $request->code,
            'data_isolation' => $dataIsolation,
            'organization_code' => (string) ($data['organization_code'] ?? ($dataIsolation['organization_code'] ?? '')),
            'updated_uid' => (string) ($data['updated_uid'] ?? ($dataIsolation['user_id'] ?? '')),
        ];
        foreach (['expected_num', 'completed_num'] as $field) {
            $this->copyIfKeyExists($params, $data, $field);
        }

        return $this->callRpc(__FUNCTION__, $params);
    }

    /**
     * 获取知识库详情.
     */
    #[RpcMethod(name: SvcMethods::METHOD_SHOW)]
    public function show(KnowledgeBaseRequestDTO $request): array
    {
        $params = [
            'code' => (string) $request->code,
            'data_isolation' => $request->dataIsolation->toArray(),
        ];
        return $this->callRpc(__FUNCTION__, $params);
    }

    /**
     * 获取知识库列表.
     */
    #[RpcMethod(name: SvcMethods::METHOD_QUERIES)]
    public function list(KnowledgeBaseRequestDTO $request): array
    {
        $params = $request->query;
        $rpcParams = [
            'data_isolation' => $request->dataIsolation->toArray(),
        ];
        foreach (['name', 'type', 'enabled', 'search_type', 'codes', 'business_ids', 'page', 'page_size', 'offset', 'limit'] as $field) {
            if (array_key_exists($field, $params)) {
                $rpcParams[$field] = $params[$field];
            }
        }
        if (array_key_exists('agent_codes', $params)) {
            $rpcParams['agent_codes'] = array_values(array_map('strval', (array) $params['agent_codes']));
        }

        return $this->callRpc(__FUNCTION__, $rpcParams);
    }

    #[RpcMethod(name: SvcMethods::METHOD_NODES)]
    public function nodes(KnowledgeBaseRequestDTO $request): array
    {
        $query = $request->query;
        $params = [
            'data_isolation' => $request->dataIsolation->toArray(),
        ];
        foreach (['source_type', 'provider', 'parent_type', 'parent_ref', 'page', 'page_size', 'offset', 'limit'] as $key) {
            if (array_key_exists($key, $query)) {
                $params[$key] = $query[$key];
            }
        }

        return $this->callRpc(__FUNCTION__, $params);
    }

    /**
     * 删除知识库.
     */
    #[RpcMethod(name: SvcMethods::METHOD_DESTROY)]
    public function destroy(KnowledgeBaseRequestDTO $request): void
    {
        $params = [
            'code' => (string) $request->code,
            'data_isolation' => $request->dataIsolation->toArray(),
        ];
        $this->callRpc(__FUNCTION__, $params);
    }

    /**
     * 手动触发知识库重建.
     */
    #[RpcMethod(name: SvcMethods::METHOD_REBUILD)]
    public function rebuild(KnowledgeBaseRequestDTO $request): array
    {
        $payload = $request->payload;

        $params = ['data_isolation' => $request->dataIsolation->toArray()];
        foreach ([
            'scope',
            'organization_code',
            'knowledge_organization_code',
            'knowledge_base_code',
            'document_code',
            'mode',
            'target_model',
            'target_dimension',
            'concurrency',
            'batch_size',
            'retry',
        ] as $field) {
            $this->copyIfKeyExists($params, $payload, $field);
        }

        return $this->callRpc(__FUNCTION__, $params);
    }

    /**
     * 补齐知识库权限.
     */
    #[RpcMethod(name: SvcMethods::METHOD_REBUILD_PERMISSIONS)]
    public function rebuildPermissions(KnowledgeBaseRequestDTO $request): array
    {
        $payload = $request->payload;

        $params = ['data_isolation' => $request->dataIsolation->toArray()];
        foreach (['knowledge_organization_code', 'limit'] as $field) {
            $this->copyIfKeyExists($params, $payload, $field);
        }
        if (array_key_exists('knowledge_base_codes', $payload)) {
            $params['knowledge_base_codes'] = array_values(array_map('strval', (array) $payload['knowledge_base_codes']));
        }

        return $this->callRpc(__FUNCTION__, $params);
    }

    /**
     * 修复历史来源绑定.
     */
    #[RpcMethod(name: SvcMethods::METHOD_REPAIR_SOURCE_BINDINGS)]
    public function repairSourceBindings(KnowledgeBaseRequestDTO $request): array
    {
        $payload = $request->payload;

        $params = ['data_isolation' => $request->dataIsolation->toArray()];
        if (array_key_exists('organization_codes', $payload)) {
            $params['organization_codes'] = $payload['organization_codes'];
        }
        foreach (['third_platform_type', 'batch_size'] as $field) {
            $this->copyIfKeyExists($params, $payload, $field);
        }

        return $this->callRpc(__FUNCTION__, $params);
    }

    /**
     * 清理重建残留集合.
     */
    #[RpcMethod(name: SvcMethods::METHOD_REBUILD_CLEANUP)]
    public function rebuildCleanup(KnowledgeBaseRequestDTO $request): array
    {
        $payload = $request->payload;

        $params = ['data_isolation' => $request->dataIsolation->toArray()];
        foreach (['apply', 'force_delete_non_empty'] as $field) {
            $this->copyIfKeyExists($params, $payload, $field);
        }

        return $this->callRpc(__FUNCTION__, $params);
    }

    /**
     * @param array<string, mixed> $params
     * @param array<string, mixed> $payload
     */
    private function copyKnowledgeBaseConfigParams(array &$params, array $payload): void
    {
        foreach (['retrieve_config', 'fragment_config', 'embedding_config'] as $key) {
            $this->copyIfKeyExists($params, $payload, $key);
        }
    }
}
