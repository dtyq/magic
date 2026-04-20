<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service;

use App\Application\KnowledgeBase\DTO\DocumentRequestDTO;
use App\Application\KnowledgeBase\DTO\KnowledgeBaseRawContextDTO;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseDocumentEntity;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\OperationAction;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Qbhy\HyperfAuth\Authenticatable;

class KnowledgeBaseDocumentAppService extends AbstractKnowledgeAppService
{
    public function saveRaw(
        Authenticatable $authorization,
        array $payload,
        string $knowledgeBaseCode,
        ?string $code = null,
    ): array {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $this->checkKnowledgeBaseOperation($dataIsolation, OperationAction::Edit->value, $knowledgeBaseCode, $code);

        $dataIsolationDTO = $context->dataIsolation();
        $payload['knowledge_base_code'] = $knowledgeBaseCode;
        $payload = $context->withOrganization($payload);
        $payload['name'] ??= (string) ($payload['document_file']['name'] ?? '');

        if ($code === null || $code === '') {
            $payload = $context->withCreatedUid($payload);
            $payload = $context->withUpdatedUid($payload);
            return $this->documentAppClient->create(DocumentRequestDTO::forCreate($payload, $dataIsolationDTO));
        }

        $payload['code'] = $code;
        $payload = $context->withUpdatedUid($payload);
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
        Page $page,
    ): array {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $this->checkKnowledgeBaseOperation(
            $dataIsolation,
            OperationAction::Read->value,
            $knowledgeBaseCode,
            isset($query['code']) ? (string) $query['code'] : null,
        );

        $rpcQuery = [
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'knowledge_base_code' => $knowledgeBaseCode,
            'page' => $page->getPage(),
            'page_size' => $page->getPageNum(),
            'offset' => $page->getSliceStart(),
            'limit' => $page->getPageNum(),
        ];
        foreach (['name', 'doc_type', 'enabled', 'sync_status'] as $field) {
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
        $this->checkKnowledgeBaseOperation($dataIsolation, OperationAction::Read->value, $knowledgeBaseCode, $documentCode);
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
        $this->checkKnowledgeBaseOperation($dataIsolation, OperationAction::Read->value, $knowledgeBaseCode, $documentCode);

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
        $this->checkKnowledgeBaseOperation($dataIsolation, OperationAction::Delete->value, $knowledgeBaseCode, $documentCode);
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
        $this->checkKnowledgeBaseOperation($dataIsolation, OperationAction::Manage->value, $knowledgeBaseCode, $documentCode);
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
        $sync = $this->normalizeReVectorizedSyncFlag($payload['sync'] ?? null);
        $this->documentAppClient->sync(DocumentRequestDTO::forSync(
            $documentCode,
            $knowledgeBaseCode,
            'resync',
            $dataIsolationDTO,
            $context->businessParams($knowledgeBaseCode),
            $sync
        ));
    }

    private function normalizeReVectorizedSyncFlag(mixed $value): bool
    {
        if ($value === null) {
            return false;
        }
        if (is_bool($value)) {
            return $value;
        }
        if (! is_scalar($value)) {
            return false;
        }
        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }
}
