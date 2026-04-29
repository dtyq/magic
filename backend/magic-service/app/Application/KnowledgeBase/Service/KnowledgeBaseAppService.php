<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service;

use App\Application\KnowledgeBase\DTO\KnowledgeBaseRawContextDTO;
use App\Application\KnowledgeBase\DTO\KnowledgeBaseRequestDTO;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\Query\KnowledgeBaseQuery;
use App\Infrastructure\Core\ValueObject\Page;
use Qbhy\HyperfAuth\Authenticatable;

class KnowledgeBaseAppService extends AbstractKnowledgeAppService
{
    public function saveRaw(
        Authenticatable $authorization,
        array $payload,
        ?string $code = null,
    ): array {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $knowledgeBaseCode = $code ?? (string) ($payload['code'] ?? '');
        if ($knowledgeBaseCode !== '') {
            $payload['code'] = $knowledgeBaseCode;
        }

        $dataIsolationDTO = $context->dataIsolation();

        if ($knowledgeBaseCode === '') {
            return $this->knowledgeBaseAppClient->create(KnowledgeBaseRequestDTO::forCreate($payload, $dataIsolationDTO));
        }

        return $this->knowledgeBaseAppClient->update(
            KnowledgeBaseRequestDTO::forUpdate($knowledgeBaseCode, $payload, $dataIsolationDTO)
        );
    }

    public function saveProcessRaw(Authenticatable $authorization, string $code, array $payload): array
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);

        $payload['code'] = $code;
        $payload = $context->withOrganization($payload);
        $payload = $context->withUpdatedUid($payload);

        return $this->knowledgeBaseAppClient->saveProcess(
            KnowledgeBaseRequestDTO::forSaveProcess(
                $code,
                $payload,
                $context->dataIsolation()
            )
        );
    }

    public function getByBusinessIdRaw(Authenticatable $authorization, string $businessId, ?int $type = null): ?array
    {
        if ($businessId === '') {
            return null;
        }

        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($this->createKnowledgeBaseDataIsolation($authorization));
        $result = $this->knowledgeBaseAppClient->list(KnowledgeBaseRequestDTO::forList([
            'type' => $type,
            'business_ids' => [$businessId],
            'offset' => 0,
            'limit' => 1,
        ], $context->dataIsolation()));

        $item = $result['list'][0] ?? null;
        return is_array($item) ? $item : null;
    }

    /**
     * @return array{total: int, list: array<KnowledgeBaseEntity>, users: array<MagicUserEntity>}
     */
    public function queries(Authenticatable $authorization, KnowledgeBaseQuery $query, Page $page): array
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $result = $this->knowledgeBaseAppClient->list(KnowledgeBaseRequestDTO::forList([
            'name' => $query->getName(),
            'type' => $query->getType(),
            'enabled' => $query->getEnabled(),
            'codes' => $query->getCodes() ?? [],
            'business_ids' => $query->getBusinessIds() ?? [],
            'offset' => $page->getSliceStart(),
            'limit' => $page->getPageNum(),
        ], $context->dataIsolation()));

        $list = array_map(static fn ($item) => new KnowledgeBaseEntity($item), $result['list'] ?? []);
        $result = [
            'total' => $result['total'] ?? 0,
            'list' => $list,
        ];
        $userIds = [];
        $iconFileLinks = $this->getIcons(
            $dataIsolation->getCurrentOrganizationCode(),
            array_map(static fn ($item) => $item->getIcon(), $result['list'])
        );
        foreach ($result['list'] as $item) {
            $userIds[] = $item->getCreator();
            $userIds[] = $item->getModifier();
            $iconFileLink = $iconFileLinks[$item->getIcon()] ?? null;
            $item->setIcon($iconFileLink?->getUrl() ?? '');
            $item->setSourceType($this->knowledgeBaseStrategy->getOrCreateDefaultSourceType($item));
        }
        $result['users'] = $this->magicUserDomainService->getByUserIds($this->createContactDataIsolationByBase($dataIsolation), $userIds);
        return $result;
    }

    public function queriesRaw(Authenticatable $authorization, array $query, ?Page $page = null): array
    {
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($this->createKnowledgeBaseDataIsolation($authorization));
        $rpcQuery = [];
        foreach (['name', 'type', 'enabled', 'search_type', 'page', 'page_size', 'offset', 'limit'] as $field) {
            if (array_key_exists($field, $query)) {
                $rpcQuery[$field] = $query[$field];
            }
        }
        if ($page !== null) {
            if (! array_key_exists('page', $rpcQuery) && ! array_key_exists('offset', $rpcQuery)) {
                $rpcQuery['page'] = $page->getPage();
            }
            if (! array_key_exists('page_size', $rpcQuery) && ! array_key_exists('limit', $rpcQuery)) {
                $rpcQuery['page_size'] = $page->getPageNum();
            }
        }
        if (array_key_exists('business_ids', $query)) {
            $rpcQuery['business_ids'] = $query['business_ids'];
        }
        if (array_key_exists('agent_codes', $query)) {
            $rpcQuery['agent_codes'] = array_values(array_map('strval', (array) $query['agent_codes']));
        }
        return $this->knowledgeBaseAppClient->list(KnowledgeBaseRequestDTO::forList($rpcQuery, $context->dataIsolation()));
    }

    public function nodes(Authenticatable $authorization, array $query): array
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        return $this->knowledgeBaseAppClient->nodes(KnowledgeBaseRequestDTO::forNodes($query, $context->dataIsolation()));
    }

    public function show(Authenticatable $authorization, string $code): KnowledgeBaseEntity
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $knowledge = new KnowledgeBaseEntity($this->knowledgeBaseAppClient->show(KnowledgeBaseRequestDTO::forShow(
            $code,
            $context->dataIsolation(),
        )));
        $knowledge->setSourceType($this->knowledgeBaseStrategy->getOrCreateDefaultSourceType($knowledge));
        $iconFileLink = $this->fileDomainService->getLink($dataIsolation->getCurrentOrganizationCode(), $knowledge->getIcon());
        $knowledge->setIcon($iconFileLink?->getUrl() ?? '');
        return $knowledge;
    }

    public function showRaw(Authenticatable $authorization, string $code): array
    {
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($this->createKnowledgeBaseDataIsolation($authorization));
        return $this->knowledgeBaseAppClient->show(KnowledgeBaseRequestDTO::forShow(
            $code,
            $context->dataIsolation(),
        ));
    }

    public function destroy(Authenticatable $authorization, string $code): void
    {
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($this->createKnowledgeBaseDataIsolation($authorization));
        $this->knowledgeBaseAppClient->destroy(KnowledgeBaseRequestDTO::forDestroy(
            $code,
            $context->dataIsolation(),
        ));
    }

    public function rebuild(Authenticatable $authorization, array $payload = []): array
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $rpcPayload = ['organization_code' => $dataIsolation->getCurrentOrganizationCode()];
        foreach ([
            'scope',
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
            if (array_key_exists($field, $payload)) {
                $rpcPayload[$field] = $payload[$field];
            }
        }
        return $this->knowledgeBaseAppClient->rebuild(
            KnowledgeBaseRequestDTO::forRebuild($rpcPayload, $context->dataIsolation())
        );
    }

    public function repairSourceBindings(Authenticatable $authorization, array $payload = []): array
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $rpcPayload = [];
        foreach (['organization_codes', 'third_platform_type', 'batch_size'] as $field) {
            if (array_key_exists($field, $payload)) {
                $rpcPayload[$field] = $payload[$field];
            }
        }
        return $this->knowledgeBaseAppClient->repairSourceBindings(
            KnowledgeBaseRequestDTO::forRepairSourceBindings($rpcPayload, $context->dataIsolation())
        );
    }

    public function rebuildCleanup(Authenticatable $authorization, array $payload = []): array
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $rpcPayload = [];
        foreach (['apply', 'force_delete_non_empty'] as $field) {
            if (array_key_exists($field, $payload)) {
                $rpcPayload[$field] = $payload[$field];
            }
        }
        return $this->knowledgeBaseAppClient->rebuildCleanup(
            KnowledgeBaseRequestDTO::forRebuildCleanup($rpcPayload, $context->dataIsolation())
        );
    }
}
