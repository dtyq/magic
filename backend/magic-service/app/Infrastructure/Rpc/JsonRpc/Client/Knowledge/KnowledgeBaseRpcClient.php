<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\JsonRpc\Client\Knowledge;

use App\Application\KnowledgeBase\DTO\KnowledgeBaseRequestDTO;
use App\Domain\KnowledgeBase\Port\KnowledgeBaseGateway;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Rpc\Annotation\RpcClient;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Client\AbstractRpcClient;
use App\Infrastructure\Rpc\Method\SvcMethods;
use Throwable;

/**
 * IPC 知识库客户端实现.
 *
 * 通过 IPC 调用 Go Engine 处理知识库管理相关操作
 */
#[RpcClient(name: SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE)]
class KnowledgeBaseRpcClient extends AbstractRpcClient implements KnowledgeBaseGateway
{
    private const int TEAMSHARE_FOLDER_FILE_TYPE = 0;

    private const int TEAMSHARE_KNOWLEDGE_BASE_FILE_TYPE = 9;

    private const int TEAMSHARE_KNOWLEDGE_BASE_SHARE_SPACE_TYPE = 8;

    /**
     * @var array<int>
     */
    private const array ENTERPRISE_SOURCE_TYPES = [4, 1001];

    /**
     * 创建知识库.
     */
    #[RpcMethod(name: SvcMethods::METHOD_CREATE)]
    public function create(KnowledgeBaseRequestDTO $request): array
    {
        $data = $request->payload;
        $dataIsolation = $request->dataIsolation->toArray();
        $params = [
            'data_isolation' => $dataIsolation,
            'organization_code' => (string) ($data['organization_code'] ?? ($dataIsolation['organization_code'] ?? '')),
            'created_uid' => (string) ($data['created_uid'] ?? ($dataIsolation['user_id'] ?? '')),
        ];

        $this->copyIfKeyExists($params, $data, 'code', transform: static fn ($value) => (string) $value);
        $this->copyIfKeyExists($params, $data, 'name', transform: static fn ($value) => (string) $value);
        $this->copyIfKeyExists($params, $data, 'description', transform: static fn ($value) => (string) $value);
        $this->copyIfKeyExists($params, $data, 'type', transform: static fn ($value) => (int) $value);
        if ($this->hasAnyKey($data, ['model', 'embedding_config'])) {
            $params['model'] = (string) ($data['model'] ?? ($data['embedding_config']['model_id'] ?? ''));
        }
        $this->copyIfKeyExists($params, $data, 'vector_db', transform: static fn ($value) => (string) $value);
        $this->copyIfKeyExists($params, $data, 'business_id', transform: static fn ($value) => (string) $value);
        $this->copyIconParams($params, $data);
        $this->copyIfKeyExists($params, $data, 'source_type', transform: static fn ($value) => $value === null ? null : (int) $value);
        if (array_key_exists('agent_codes', $data)) {
            $params['agent_codes'] = array_values(array_map('strval', (array) $data['agent_codes']));
        }
        $this->copyIfKeyExists($params, $data, 'retrieve_config');
        $this->copyIfKeyExists($params, $data, 'fragment_config');
        $this->copyIfKeyExists($params, $data, 'embedding_config');
        $sourceBindings = $this->resolveSourceBindingsPayload($data, $dataIsolation);
        if ($sourceBindings !== null) {
            $params['source_bindings'] = $sourceBindings;
        }

        return $this->callRpc(__FUNCTION__, $params);
    }

    /**
     * 更新知识库.
     */
    #[RpcMethod(name: SvcMethods::METHOD_UPDATE)]
    public function update(KnowledgeBaseRequestDTO $request): array
    {
        $data = $request->payload;
        $dataIsolation = $request->dataIsolation->toArray();
        $params = [
            'code' => (string) $request->code,
            'data_isolation' => $dataIsolation,
            'organization_code' => (string) ($data['organization_code'] ?? ($dataIsolation['organization_code'] ?? '')),
            'updated_uid' => (string) ($data['updated_uid'] ?? ($dataIsolation['user_id'] ?? '')),
        ];
        $this->copyIfKeyExists($params, $data, 'name', transform: static fn ($value) => (string) $value);
        $this->copyIfKeyExists($params, $data, 'description', transform: static fn ($value) => (string) $value);
        if ($this->hasAnyKey($data, ['enabled', 'status'])) {
            $params['enabled'] = $this->resolveNullableBool($data, ['enabled', 'status']);
        }
        $this->copyIconParams($params, $data);
        $this->copyIfKeyExists($params, $data, 'source_type', transform: static fn ($value) => $value === null ? null : (int) $value);
        $this->copyIfKeyExists($params, $data, 'retrieve_config');
        $this->copyIfKeyExists($params, $data, 'fragment_config');
        $this->copyIfKeyExists($params, $data, 'embedding_config');
        $sourceBindings = $this->resolveSourceBindingsPayload($data, $dataIsolation);
        if ($sourceBindings !== null) {
            $params['source_bindings'] = $sourceBindings;
        }
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

        return $this->callRpc(__FUNCTION__, [
            'code' => (string) $request->code,
            'data_isolation' => $dataIsolation,
            'expected_num' => (int) ($data['expected_num'] ?? 0),
            'completed_num' => (int) ($data['completed_num'] ?? 0),
            'organization_code' => (string) ($data['organization_code'] ?? ($dataIsolation['organization_code'] ?? '')),
            'updated_uid' => (string) ($data['updated_uid'] ?? ($dataIsolation['user_id'] ?? '')),
        ]);
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
        ['limit' => $limit, 'offset' => $offset] = $this->resolvePageWindow($params);
        $rpcParams = [
            'data_isolation' => $request->dataIsolation->toArray(),
            'codes' => $params['codes'] ?? [],
            'offset' => $offset,
            'limit' => $limit,
        ];
        if (array_key_exists('name', $params)) {
            $rpcParams['name'] = (string) $params['name'];
        }
        if (array_key_exists('type', $params)) {
            $rpcParams['type'] = $params['type'] === null ? null : (int) $params['type'];
        }
        if ($this->hasAnyKey($params, ['enabled'])) {
            $rpcParams['enabled'] = $this->resolveNullableBool($params, ['enabled']);
        }
        if (array_key_exists('agent_codes', $params)) {
            $rpcParams['agent_codes'] = array_values(array_map('strval', (array) $params['agent_codes']));
        }
        if (array_key_exists('business_ids', $params)) {
            $rpcParams['business_ids'] = $params['business_ids'];
        }

        return $this->callRpc(__FUNCTION__, $rpcParams);
    }

    #[RpcMethod(name: SvcMethods::METHOD_NODES)]
    public function nodes(KnowledgeBaseRequestDTO $request): array
    {
        $query = $request->query;
        ['limit' => $limit, 'offset' => $offset] = $this->resolvePageWindow($query);

        return $this->callRpc(__FUNCTION__, [
            'data_isolation' => $request->dataIsolation->toArray(),
            'source_type' => (string) ($query['source_type'] ?? ''),
            'provider' => (string) ($query['provider'] ?? ''),
            'parent_type' => (string) ($query['parent_type'] ?? ''),
            'parent_ref' => (string) ($query['parent_ref'] ?? ''),
            'offset' => $offset,
            'limit' => $limit,
        ]);
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

        return $this->callRpc(__FUNCTION__, [
            'data_isolation' => $request->dataIsolation->toArray(),
            'scope' => (string) ($payload['scope'] ?? 'all'),
            'organization_code' => (string) ($payload['organization_code'] ?? ''),
            'knowledge_organization_code' => (string) ($payload['knowledge_organization_code'] ?? ''),
            'knowledge_base_code' => (string) ($payload['knowledge_base_code'] ?? ''),
            'document_code' => (string) ($payload['document_code'] ?? ''),
            'mode' => (string) ($payload['mode'] ?? 'auto'),
            'target_model' => (string) ($payload['target_model'] ?? ''),
            'target_dimension' => isset($payload['target_dimension']) ? (int) $payload['target_dimension'] : 0,
            'concurrency' => isset($payload['concurrency']) ? (int) $payload['concurrency'] : 0,
            'batch_size' => isset($payload['batch_size']) ? (int) $payload['batch_size'] : 0,
            'retry' => isset($payload['retry']) ? (int) $payload['retry'] : 0,
        ]);
    }

    /**
     * 修复历史来源绑定.
     */
    #[RpcMethod(name: SvcMethods::METHOD_REPAIR_SOURCE_BINDINGS)]
    public function repairSourceBindings(KnowledgeBaseRequestDTO $request): array
    {
        $payload = $request->payload;

        return $this->callRpc(__FUNCTION__, [
            'data_isolation' => $request->dataIsolation->toArray(),
            'organization_codes' => array_values(array_map('strval', (array) ($payload['organization_codes'] ?? []))),
            'third_platform_type' => (string) ($payload['third_platform_type'] ?? 'teamshare'),
            'batch_size' => isset($payload['batch_size']) ? (int) $payload['batch_size'] : 0,
        ]);
    }

    /**
     * 清理重建残留集合.
     */
    #[RpcMethod(name: SvcMethods::METHOD_REBUILD_CLEANUP)]
    public function rebuildCleanup(KnowledgeBaseRequestDTO $request): array
    {
        $payload = $request->payload;

        return $this->callRpc(__FUNCTION__, [
            'data_isolation' => $request->dataIsolation->toArray(),
            'apply' => (bool) ($payload['apply'] ?? false),
            'force_delete_non_empty' => (bool) ($payload['force_delete_non_empty'] ?? false),
        ]);
    }

    /**
     * @param array<string, mixed> $payload
     * @param array<int, string> $keys
     */
    private function resolveNullableBool(array $payload, array $keys): ?bool
    {
        foreach ($keys as $key) {
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
     * @return array<int, array<string, mixed>>
     */
    private function normalizeSourceBindings(mixed $bindings): array
    {
        return $this->normalizeItems($bindings, $this->normalizeSourceBinding(...));
    }

    /**
     * @param array<string, mixed> $payload
     * @param array<string, mixed> $dataIsolation
     * @return null|array<int, array<string, mixed>>
     */
    private function resolveSourceBindingsPayload(array $payload, array $dataIsolation): ?array
    {
        if (array_key_exists('source_bindings', $payload)) {
            return $this->normalizeSourceBindings($payload['source_bindings']);
        }

        if (! array_key_exists('document_files', $payload)) {
            return null;
        }

        return $this->normalizeLegacyDocumentFiles(
            $payload['document_files'],
            isset($payload['source_type']) ? (int) $payload['source_type'] : null,
            $dataIsolation,
        );
    }

    /**
     * @param array<string, mixed> $dataIsolation
     * @return array<int, array<string, mixed>>
     */
    private function normalizeLegacyDocumentFiles(mixed $documentFiles, ?int $sourceType, array $dataIsolation): array
    {
        $normalizedDocumentFiles = $this->normalizeItems($documentFiles, function (mixed $documentFile): ?array {
            if (! is_array($documentFile)) {
                return null;
            }

            $normalized = $this->normalizeDocumentFile($documentFile);
            return $normalized === [] ? null : $normalized;
        });

        if ($normalizedDocumentFiles === []) {
            return [];
        }

        $effectiveDocumentFiles = $normalizedDocumentFiles;
        if ($sourceType === null || $this->isEnterpriseSourceType($sourceType)) {
            $effectiveDocumentFiles = $this->expandLegacyThirdPlatformDocumentFiles($normalizedDocumentFiles, $dataIsolation);
        }

        if ($this->isEnterpriseSourceType($sourceType) || $this->hasEnterpriseKnowledgeBaseBinding($effectiveDocumentFiles)) {
            return $this->normalizeLegacyEnterpriseDocumentFiles(
                $effectiveDocumentFiles,
                $this->isEnterpriseSourceType($sourceType),
            );
        }

        return $this->normalizeItems($effectiveDocumentFiles, $this->normalizeLegacyDocumentFileBinding(...));
    }

    /**
     * @param array<int, array<string, mixed>> $documentFiles
     * @param array<string, mixed> $dataIsolation
     * @return array<int, array<string, mixed>>
     */
    private function expandLegacyThirdPlatformDocumentFiles(array $documentFiles, array $dataIsolation): array
    {
        $thirdPlatformDocumentFiles = array_values(array_filter(
            $documentFiles,
            fn (array $documentFile): bool => $this->isThirdPlatformDocumentFile($documentFile),
        ));
        if ($thirdPlatformDocumentFiles === []) {
            return $documentFiles;
        }

        try {
            $response = $this->client->call(
                SvcMethods::SERVICE_KNOWLEDGE_THIRD_PLATFORM_DOCUMENT . '.' . SvcMethods::METHOD_EXPAND,
                [
                    'data_isolation' => $dataIsolation,
                    'document_files' => $thirdPlatformDocumentFiles,
                ],
            );
        } catch (Throwable) {
            return $documentFiles;
        }

        if (($response['code'] ?? null) !== 0 || ! is_array($response['data'] ?? null)) {
            return $documentFiles;
        }

        $expandedDocumentFiles = $this->normalizeItems($response['data'], function (mixed $documentFile): ?array {
            if (! is_array($documentFile)) {
                return null;
            }

            $normalized = $this->normalizeDocumentFile($documentFile);
            return $normalized === [] ? null : $normalized;
        });
        if ($expandedDocumentFiles === []) {
            return $documentFiles;
        }

        $nonThirdPlatformDocumentFiles = array_values(array_filter(
            $documentFiles,
            fn (array $documentFile): bool => ! $this->isThirdPlatformDocumentFile($documentFile),
        ));

        return array_values(array_merge($nonThirdPlatformDocumentFiles, $expandedDocumentFiles));
    }

    /**
     * @param array<int, array<string, mixed>> $documentFiles
     * @return array<int, array<string, mixed>>
     */
    private function normalizeLegacyEnterpriseDocumentFiles(array $documentFiles, bool $strictEnterprise = false): array
    {
        $bindings = [];
        $targetSeen = [];

        foreach ($documentFiles as $documentFile) {
            if (! $this->isThirdPlatformDocumentFile($documentFile)) {
                if ($strictEnterprise) {
                    $this->throwInvalidLegacyEnterpriseDocumentFiles();
                }
                $binding = $this->normalizeLegacyDocumentFileBinding($documentFile);
                if ($binding !== null) {
                    $bindings[] = $binding;
                }
                continue;
            }

            $provider = $this->resolvePreferredString(
                (string) ($documentFile['source_type'] ?? ''),
                (string) ($documentFile['platform_type'] ?? ''),
                'teamshare',
            );
            $knowledgeBaseId = $this->resolveEnterpriseKnowledgeBaseRootRef($documentFile);
            if ($provider === '' || $knowledgeBaseId === '') {
                if ($strictEnterprise) {
                    $this->throwInvalidLegacyEnterpriseDocumentFiles();
                }
                $binding = $this->normalizeLegacyDocumentFileBinding($documentFile);
                if ($binding !== null) {
                    $bindings[] = $binding;
                }
                continue;
            }

            $bindingKey = $provider . ':' . $knowledgeBaseId;
            if (! isset($bindings[$bindingKey])) {
                $bindings[$bindingKey] = [
                    'provider' => $provider,
                    'root_type' => 'knowledge_base',
                    'root_ref' => $knowledgeBaseId,
                    'sync_mode' => 'manual',
                    'enabled' => true,
                    'sync_config' => [
                        'root_context' => [
                            'knowledge_base_id' => $knowledgeBaseId,
                        ],
                    ],
                    'targets' => [],
                ];
                $targetSeen[$bindingKey] = [];
            }

            $targetRef = $this->resolvePreferredString(
                (string) ($documentFile['third_id'] ?? ''),
                (string) ($documentFile['third_file_id'] ?? ''),
            );
            if ($targetRef === '' || ($this->isTeamshareKnowledgeBaseRoot($documentFile) && $targetRef === $knowledgeBaseId)) {
                continue;
            }

            $targetType = $this->isTeamshareFolderDocument($documentFile) ? 'folder' : 'file';
            $targetKey = $targetType . ':' . $targetRef;
            if (isset($targetSeen[$bindingKey][$targetKey])) {
                continue;
            }

            $targetSeen[$bindingKey][$targetKey] = true;
            $bindings[$bindingKey]['targets'][] = [
                'target_type' => $targetType,
                'target_ref' => $targetRef,
            ];
        }

        return array_values($bindings);
    }

    private function isEnterpriseSourceType(?int $sourceType): bool
    {
        return $sourceType !== null && in_array($sourceType, self::ENTERPRISE_SOURCE_TYPES, true);
    }

    /**
     * @param array<int, array<string, mixed>> $documentFiles
     */
    private function hasEnterpriseKnowledgeBaseBinding(array $documentFiles): bool
    {
        foreach ($documentFiles as $documentFile) {
            if (! $this->isThirdPlatformDocumentFile($documentFile)) {
                continue;
            }

            $provider = $this->resolvePreferredString(
                (string) ($documentFile['source_type'] ?? ''),
                (string) ($documentFile['platform_type'] ?? ''),
                'teamshare',
            );
            $knowledgeBaseId = $this->resolveEnterpriseKnowledgeBaseRootRef($documentFile);
            if ($provider !== '' && $knowledgeBaseId !== '') {
                return true;
            }
        }

        return false;
    }

    /**
     * @return null|array<string, mixed>
     */
    private function normalizeLegacyDocumentFileBinding(mixed $documentFile): ?array
    {
        if (! is_array($documentFile)) {
            return null;
        }

        $normalizedDocumentFile = $this->normalizeDocumentFile($documentFile);
        if ($normalizedDocumentFile === []) {
            return null;
        }

        $identity = $this->resolveLegacyDocumentFileBindingIdentity($normalizedDocumentFile);
        if ($identity['provider'] === '' || $identity['root_type'] === '' || $identity['root_ref'] === '') {
            return null;
        }

        return [
            'provider' => $identity['provider'],
            'root_type' => $identity['root_type'],
            'root_ref' => $identity['root_ref'],
            'sync_mode' => 'manual',
            'enabled' => true,
            'sync_config' => [
                'document_file' => $normalizedDocumentFile,
            ],
            'targets' => [],
        ];
    }

    /**
     * @param array<string, mixed> $documentFile
     * @return array{provider: string, root_type: string, root_ref: string}
     */
    private function resolveLegacyDocumentFileBindingIdentity(array $documentFile): array
    {
        if (! $this->isThirdPlatformDocumentFile($documentFile)) {
            return [
                'provider' => 'local_upload',
                'root_type' => 'file',
                'root_ref' => $this->resolvePreferredString(
                    (string) ($documentFile['url'] ?? ''),
                    (string) ($documentFile['key'] ?? ''),
                    (string) ($documentFile['name'] ?? ''),
                ),
            ];
        }

        $provider = $this->resolvePreferredString(
            (string) ($documentFile['source_type'] ?? ''),
            (string) ($documentFile['platform_type'] ?? ''),
            'teamshare',
        );
        $rootRef = $this->resolveEnterpriseKnowledgeBaseRootRef($documentFile);
        $rootType = 'knowledge_base';
        if ($rootRef === '') {
            $rootRef = $this->resolvePreferredString(
                (string) ($documentFile['third_id'] ?? ''),
                (string) ($documentFile['third_file_id'] ?? ''),
            );
            $rootType = $this->isTeamshareFolderDocument($documentFile) ? 'folder' : 'file';
        }

        return [
            'provider' => $provider,
            'root_type' => $rootType,
            'root_ref' => trim($rootRef),
        ];
    }

    /**
     * @param array<string, mixed> $documentFile
     */
    private function isThirdPlatformDocumentFile(array $documentFile): bool
    {
        if ($this->normalizeDocumentFileType($documentFile['type'] ?? null) === 'third_platform') {
            return true;
        }

        return $this->resolvePreferredString(
            (string) ($documentFile['third_id'] ?? ''),
            (string) ($documentFile['third_file_id'] ?? ''),
            (string) ($documentFile['source_type'] ?? ''),
            (string) ($documentFile['platform_type'] ?? ''),
            (string) ($documentFile['knowledge_base_id'] ?? ''),
        ) !== '';
    }

    /**
     * @return null|array<string, mixed>
     */
    private function normalizeSourceBinding(mixed $binding): ?array
    {
        if (! is_array($binding)) {
            return null;
        }

        return [
            'provider' => (string) ($binding['provider'] ?? ''),
            'root_type' => (string) ($binding['root_type'] ?? ''),
            'root_ref' => (string) ($binding['root_ref'] ?? ''),
            'sync_mode' => (string) ($binding['sync_mode'] ?? 'manual'),
            'enabled' => ! array_key_exists('enabled', $binding) || $binding['enabled'],
            'sync_config' => $this->normalizeSyncConfig($binding['sync_config'] ?? null),
            'targets' => $this->normalizeSourceBindingTargets($binding['targets'] ?? []),
        ];
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function normalizeSourceBindingTargets(mixed $targets): array
    {
        return $this->normalizeItems($targets, $this->normalizeSourceBindingTarget(...));
    }

    /**
     * @return null|array<string, string>
     */
    private function normalizeSourceBindingTarget(mixed $target): ?array
    {
        if (! is_array($target)) {
            return null;
        }

        return [
            'target_type' => (string) ($target['target_type'] ?? ''),
            'target_ref' => (string) ($target['target_ref'] ?? ''),
        ];
    }

    /**
     * @template T of array<string, mixed>
     * @param callable(mixed): ?T $normalizer
     * @return array<int, T>
     */
    private function normalizeItems(mixed $items, callable $normalizer): array
    {
        $normalizedItems = [];

        foreach ((array) $items as $item) {
            $normalizedItem = $normalizer($item);
            if ($normalizedItem === null) {
                continue;
            }

            $normalizedItems[] = $normalizedItem;
        }

        return $normalizedItems;
    }

    /**
     * @param array<string, mixed> $params
     * @param array<string, mixed> $payload
     */
    private function copyIconParams(array &$params, array $payload): void
    {
        if (! $this->hasAnyKey($payload, ['icon', 'avatar'])) {
            return;
        }

        $icon = (string) ($payload['icon'] ?? $payload['avatar'] ?? '');
        $params['icon'] = $icon;
        $params['avatar'] = $icon;
    }

    /**
     * @return array<string, mixed>
     */
    private function normalizeSyncConfig(mixed $syncConfig): array
    {
        $normalized = $this->normalizeMetadataPayload($syncConfig);
        return is_array($normalized) ? $normalized : [];
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
            'third_file_type' => $this->normalizeLegacyThirdFileType($documentFile),
            'third_file_extension_name' => (string) ($documentFile['third_file_extension_name'] ?? ''),
            'knowledge_base_id' => (string) ($documentFile['knowledge_base_id'] ?? ''),
            'file_type' => $this->normalizeOptionalInt($documentFile['file_type'] ?? null),
            'space_type' => $this->normalizeOptionalInt($documentFile['space_type'] ?? null),
        ];
    }

    /**
     * @param array<string, mixed> $documentFile
     */
    private function normalizeLegacyThirdFileType(array $documentFile): string
    {
        $thirdFileType = $this->resolvePreferredString((string) ($documentFile['third_file_type'] ?? ''));
        if ($thirdFileType !== '') {
            return $thirdFileType;
        }

        $fileType = $this->normalizeOptionalInt($documentFile['file_type'] ?? null);
        return $fileType === null ? '' : (string) $fileType;
    }

    /**
     * @param array<string, mixed> $documentFile
     */
    private function resolveEnterpriseKnowledgeBaseRootRef(array $documentFile): string
    {
        $knowledgeBaseId = $this->resolvePreferredString((string) ($documentFile['knowledge_base_id'] ?? ''));
        if ($knowledgeBaseId !== '') {
            return $knowledgeBaseId;
        }

        if (! $this->isTeamshareKnowledgeBaseRoot($documentFile)) {
            return '';
        }

        return $this->resolvePreferredString(
            (string) ($documentFile['third_id'] ?? ''),
            (string) ($documentFile['third_file_id'] ?? ''),
        );
    }

    /**
     * @param array<string, mixed> $documentFile
     */
    private function isTeamshareKnowledgeBaseRoot(array $documentFile): bool
    {
        if (! $this->isTeamshareDocumentFile($documentFile)) {
            return false;
        }

        if ($this->resolvePreferredString((string) ($documentFile['knowledge_base_id'] ?? '')) !== '') {
            return true;
        }

        $spaceType = $this->normalizeOptionalInt($documentFile['space_type'] ?? null);
        $fileType = $this->resolveTeamshareFileType($documentFile);

        return $fileType === self::TEAMSHARE_KNOWLEDGE_BASE_FILE_TYPE
            && $spaceType === self::TEAMSHARE_KNOWLEDGE_BASE_SHARE_SPACE_TYPE;
    }

    /**
     * @param array<string, mixed> $documentFile
     */
    private function isTeamshareFolderDocument(array $documentFile): bool
    {
        if (strtolower(trim((string) ($documentFile['third_file_type'] ?? ''))) === 'folder') {
            return true;
        }

        return $this->resolveTeamshareFileType($documentFile) === self::TEAMSHARE_FOLDER_FILE_TYPE;
    }

    /**
     * @param array<string, mixed> $documentFile
     */
    private function isTeamshareDocumentFile(array $documentFile): bool
    {
        if (! $this->isThirdPlatformDocumentFile($documentFile)) {
            return false;
        }

        return strtolower($this->resolvePreferredString(
            (string) ($documentFile['source_type'] ?? ''),
            (string) ($documentFile['platform_type'] ?? ''),
            'teamshare',
        )) === 'teamshare';
    }

    /**
     * @param array<string, mixed> $documentFile
     */
    private function resolveTeamshareFileType(array $documentFile): ?int
    {
        $thirdFileType = strtolower(trim((string) ($documentFile['third_file_type'] ?? '')));
        if ($thirdFileType === 'folder') {
            return self::TEAMSHARE_FOLDER_FILE_TYPE;
        }
        if ($thirdFileType !== '' && is_numeric($thirdFileType)) {
            return (int) $thirdFileType;
        }

        return $this->normalizeOptionalInt($documentFile['file_type'] ?? null);
    }

    private function normalizeOptionalInt(mixed $value): ?int
    {
        if (is_int($value)) {
            return $value;
        }
        if (is_string($value) && trim($value) !== '' && is_numeric($value)) {
            return (int) $value;
        }
        if (is_float($value)) {
            return (int) $value;
        }
        return null;
    }

    /**
     * @return never
     */
    private function throwInvalidLegacyEnterpriseDocumentFiles(): void
    {
        throw new BusinessException(
            'legacy document_files must identify a teamshare knowledge_base root when source_type is enterprise',
            FlowErrorCode::ValidateFailed->value,
        );
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
