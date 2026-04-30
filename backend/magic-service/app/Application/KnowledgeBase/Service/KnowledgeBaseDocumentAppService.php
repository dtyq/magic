<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service;

use App\Application\KnowledgeBase\DTO\DocumentRequestDTO;
use App\Application\KnowledgeBase\DTO\KnowledgeBaseRawContextDTO;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseDocumentEntity;
use App\ErrorCode\FlowErrorCode;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Coroutine\Coroutine;
use Qbhy\HyperfAuth\Authenticatable;

class KnowledgeBaseDocumentAppService extends AbstractKnowledgeAppService
{
    private const int REVECTORIZED_SYNC_WAIT_TIMEOUT_SECONDS = 20;

    private const float REVECTORIZED_SYNC_POLL_INTERVAL_SECONDS = 0.5;

    public function saveRaw(
        Authenticatable $authorization,
        array $payload,
        string $knowledgeBaseCode,
        ?string $code = null,
    ): array {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);

        $dataIsolationDTO = $context->dataIsolation();
        $payload['knowledge_base_code'] = $knowledgeBaseCode;
        $payload = $context->withOrganization($payload);
        $payload = $context->withUserId($payload);

        if ($code === null || $code === '') {
            return $this->documentAppClient->create(DocumentRequestDTO::forCreate($payload, $dataIsolationDTO));
        }

        $payload['code'] = $code;
        return $this->documentAppClient->update(DocumentRequestDTO::forUpdate(
            $code,
            $payload,
            $dataIsolationDTO,
            $knowledgeBaseCode
        ));
    }

    /**
     * 查询知识库文档列表.
     */
    public function queryRaw(
        Authenticatable $authorization,
        array $query,
        string $knowledgeBaseCode,
    ): array {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);

        $rpcQuery = [
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'knowledge_base_code' => $knowledgeBaseCode,
        ];
        foreach (['name', 'doc_type', 'enabled', 'sync_status', 'page', 'page_size', 'offset', 'limit'] as $field) {
            if (array_key_exists($field, $query)) {
                $rpcQuery[$field] = $query[$field];
            }
        }
        return $this->documentAppClient->list(DocumentRequestDTO::forList($rpcQuery, $context->dataIsolation()));
    }

    /**
     * @noinspection PhpUnused
     *
     * @return array<KnowledgeBaseDocumentEntity>
     */
    public function getByThirdFileId(
        Authenticatable $authorization,
        string $thirdPlatformType,
        string $thirdFileId,
        ?string $knowledgeBaseCode = null,
    ): array {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $documents = $this->documentAppClient->getByThirdFileId(DocumentRequestDTO::forGetByThirdFileId(
            $thirdPlatformType,
            $thirdFileId,
            $context->dataIsolation(),
            $knowledgeBaseCode,
        ));

        return array_map(static fn (array $item) => new KnowledgeBaseDocumentEntity($item), $documents);
    }

    public function reVectorizedByThirdFileId(
        Authenticatable $authorization,
        string $thirdPlatformType,
        string $thirdFileId,
        ?string $thirdKnowledgeId = null
    ): void {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $this->documentAppClient->reVectorizedByThirdFileId(DocumentRequestDTO::forReVectorizedByThirdFileId(
            $thirdPlatformType,
            $thirdFileId,
            $context->dataIsolation(),
            $thirdKnowledgeId,
        ));
    }

    public function showRaw(
        Authenticatable $authorization,
        string $knowledgeBaseCode,
        string $documentCode,
    ): array {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        return $this->documentAppClient->show(DocumentRequestDTO::forShow(
            $documentCode,
            $knowledgeBaseCode,
            $context->dataIsolation(),
        ));
    }

    /**
     * @return array{available: bool, url: string, name: string, key: string, type: string}
     */
    public function originalFileLink(
        Authenticatable $authorization,
        string $knowledgeBaseCode,
        string $documentCode,
    ): array {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);

        $result = $this->documentAppClient->getOriginalFileLink(DocumentRequestDTO::forOriginalFileLink(
            $documentCode,
            $knowledgeBaseCode,
            $context->dataIsolation(),
        ));

        return [
            'available' => (bool) ($result['available'] ?? false),
            'url' => (string) ($result['url'] ?? ''),
            'name' => (string) ($result['name'] ?? ''),
            'key' => (string) ($result['key'] ?? ''),
            'type' => (string) ($result['type'] ?? ''),
        ];
    }

    /**
     * 删除知识库文档.
     */
    public function destroy(
        Authenticatable $authorization,
        string $knowledgeBaseCode,
        string $documentCode,
    ): void {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $this->documentAppClient->destroy(DocumentRequestDTO::forDestroy(
            $documentCode,
            $knowledgeBaseCode,
            $context->dataIsolation(),
        ));
    }

    /**
     * 重新向量化.
     */
    public function reVectorized(
        Authenticatable $authorization,
        string $knowledgeBaseCode,
        string $documentCode,
        array $payload = [],
    ): void {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $dataIsolationDTO = $context->dataIsolation();
        $documentEntity = new KnowledgeBaseDocumentEntity($this->documentAppClient->show(DocumentRequestDTO::forShow(
            $documentCode,
            $knowledgeBaseCode,
            $dataIsolationDTO,
        )));
        // 由于历史文档没有 document_file 字段，不能被重新向量化
        if (! $documentEntity->getDocumentFile()) {
            ExceptionBuilder::throw(PermissionErrorCode::Error, 'flow.knowledge_base.re_vectorized_not_support');
        }
        // 这是“当前文档手动重试”的入口，URL 已经显式指定 knowledge_base_code + document_code。
        // 这里绝不能再借 third-file 链路扩散到别的知识库，否则接口语义会从“单文档”变成“广播”。
        $this->documentAppClient->sync(DocumentRequestDTO::forSync(
            $documentCode,
            $knowledgeBaseCode,
            'resync',
            $dataIsolationDTO,
            $context->businessParams($knowledgeBaseCode),
            DocumentRequestDTO::REVECTORIZE_SOURCE_SINGLE_DOCUMENT_MANUAL,
        ));

        if ($this->shouldWaitForReVectorizedSync($payload)) {
            $this->waitForReVectorizedSyncStatusChanged(
                $context,
                $knowledgeBaseCode,
                $documentCode,
                $documentEntity->getSyncStatus(),
            );
        }
    }

    private function shouldWaitForReVectorizedSync(array $payload): bool
    {
        if (! array_key_exists('sync', $payload)) {
            return false;
        }

        $sync = $payload['sync'];
        if (is_bool($sync)) {
            return $sync;
        }
        if (is_int($sync)) {
            return $sync === 1;
        }
        if (is_float($sync)) {
            return $sync === 1.0;
        }
        if (is_string($sync)) {
            $parsed = filter_var($sync, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            return $parsed ?? false;
        }

        return false;
    }

    private function waitForReVectorizedSyncStatusChanged(
        KnowledgeBaseRawContextDTO $context,
        string $knowledgeBaseCode,
        string $documentCode,
        int $beforeSyncStatus,
    ): void {
        $deadline = microtime(true) + self::REVECTORIZED_SYNC_WAIT_TIMEOUT_SECONDS;
        $dataIsolationDTO = $context->dataIsolation();

        while (microtime(true) < $deadline) {
            $currentDocument = new KnowledgeBaseDocumentEntity($this->documentAppClient->show(DocumentRequestDTO::forShow(
                $documentCode,
                $knowledgeBaseCode,
                $dataIsolationDTO,
            )));
            if ($currentDocument->getSyncStatus() !== $beforeSyncStatus) {
                return;
            }

            $remainingSeconds = $deadline - microtime(true);
            if ($remainingSeconds <= 0) {
                break;
            }
            Coroutine::sleep(min(self::REVECTORIZED_SYNC_POLL_INTERVAL_SECONDS, $remainingSeconds));
        }

        $this->logger->warning('knowledge_base_document_re_vectorized_sync_wait_timeout', [
            'organization_code' => $context->organizationCode,
            'knowledge_base_code' => $knowledgeBaseCode,
            'document_code' => $documentCode,
            'before_status' => $beforeSyncStatus,
            'timeout_seconds' => self::REVECTORIZED_SYNC_WAIT_TIMEOUT_SECONDS,
        ]);

        ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'common.request_timeout');
    }
}
