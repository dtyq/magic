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
use App\Domain\KnowledgeBase\Entity\ValueObject\SearchType;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\OperationAction;
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
            $operation = $this->knowledgeBaseStrategy->getKnowledgeOperation($dataIsolation, $knowledgeBaseCode);
            $operation->validate(OperationAction::Edit->value, $knowledgeBaseCode);
            $payload['code'] = $knowledgeBaseCode;
        }

        $dataIsolationDTO = $context->dataIsolation();
        $payload = $context->withOrganization($payload);

        if ($knowledgeBaseCode === '') {
            $payload = $context->withCreatedUid($payload);
            return $this->knowledgeBaseAppClient->create(KnowledgeBaseRequestDTO::forCreate($payload, $dataIsolationDTO));
        }

        $payload = $context->withUpdatedUid($payload);
        return $this->knowledgeBaseAppClient->update(
            KnowledgeBaseRequestDTO::forUpdate($knowledgeBaseCode, $payload, $dataIsolationDTO)
        );
    }

    public function saveProcessRaw(Authenticatable $authorization, string $code, array $payload): array
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $this->checkKnowledgeBaseOperation($dataIsolation, OperationAction::Edit->value, $code);

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

        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $resources = $this->knowledgeBaseStrategy->getKnowledgeBaseOperations($dataIsolation);

        $result = $this->knowledgeBaseAppClient->list(KnowledgeBaseRequestDTO::forList([
            'type' => $type,
            'codes' => array_keys($resources),
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

        $resources = $this->knowledgeBaseStrategy->getKnowledgeBaseOperations($dataIsolation);

        $query->setCodes(array_keys($resources));
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
            $item->setUserOperation(($resources[$item->getCode()] ?? Operation::None)->value);
            $item->setSourceType($this->knowledgeBaseStrategy->getOrCreateDefaultSourceType($item));
        }
        $result['users'] = $this->magicUserDomainService->getByUserIds($this->createContactDataIsolationByBase($dataIsolation), $userIds);
        return $result;
    }

    public function queriesRaw(Authenticatable $authorization, array $query, Page $page): array
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $resources = $this->knowledgeBaseStrategy->getKnowledgeBaseOperations($dataIsolation);
        $rpcQuery = [
            'codes' => array_keys($resources),
            'enabled' => $this->resolveKnowledgeEnabled($query),
            'page' => $page->getPage(),
            'page_size' => $page->getPageNum(),
            'offset' => $page->getSliceStart(),
            'limit' => $page->getPageNum(),
        ];
        if (array_key_exists('name', $query)) {
            $rpcQuery['name'] = $query['name'];
        }
        if (array_key_exists('type', $query)) {
            $rpcQuery['type'] = $query['type'];
        }
        if (array_key_exists('business_ids', $query)) {
            $rpcQuery['business_ids'] = (array) $query['business_ids'];
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

        return $this->knowledgeBaseAppClient->nodes(KnowledgeBaseRequestDTO::forNodes(
            [
                'source_type' => (string) ($query['source_type'] ?? ''),
                'provider' => (string) ($query['provider'] ?? ''),
                'parent_type' => (string) ($query['parent_type'] ?? ''),
                'parent_ref' => (string) ($query['parent_ref'] ?? ''),
                'page' => (int) ($query['page'] ?? 1),
                'page_size' => (int) ($query['page_size'] ?? 20),
            ],
            $context->dataIsolation()
        ));
    }

    public function show(Authenticatable $authorization, string $code, array $query = []): KnowledgeBaseEntity
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $operation = $this->checkKnowledgeBaseOperation($dataIsolation, OperationAction::Read->value, $code);
        $knowledge = new KnowledgeBaseEntity($this->knowledgeBaseAppClient->show(KnowledgeBaseRequestDTO::forShow(
            $code,
            $context->dataIsolation(),
        )));
        $knowledge->setUserOperation($operation->value);
        $knowledge->setSourceType($this->knowledgeBaseStrategy->getOrCreateDefaultSourceType($knowledge));
        $iconFileLink = $this->fileDomainService->getLink($dataIsolation->getCurrentOrganizationCode(), $knowledge->getIcon());
        $knowledge->setIcon($iconFileLink?->getUrl() ?? '');
        return $knowledge;
    }

    public function showRaw(Authenticatable $authorization, string $code): array
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $this->checkKnowledgeBaseOperation($dataIsolation, OperationAction::Read->value, $code);
        return $this->knowledgeBaseAppClient->show(KnowledgeBaseRequestDTO::forShow(
            $code,
            $context->dataIsolation(),
        ));
    }

    public function destroy(Authenticatable $authorization, string $code): void
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        $this->checkKnowledgeBaseOperation($dataIsolation, OperationAction::Delete->value, $code);
        $this->knowledgeBaseAppClient->destroy(KnowledgeBaseRequestDTO::forDestroy(
            $code,
            $context->dataIsolation(),
        ));
    }

    public function rebuild(Authenticatable $authorization, array $payload = []): array
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        return $this->knowledgeBaseAppClient->rebuild(KnowledgeBaseRequestDTO::forRebuild(
            [
                'scope' => (string) ($payload['scope'] ?? 'all'),
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                'knowledge_organization_code' => (string) ($payload['knowledge_organization_code'] ?? ''),
                'knowledge_base_code' => (string) ($payload['knowledge_base_code'] ?? ''),
                'document_code' => (string) ($payload['document_code'] ?? ''),
                'mode' => (string) ($payload['mode'] ?? 'auto'),
                'target_model' => (string) ($payload['target_model'] ?? ''),
                'target_dimension' => isset($payload['target_dimension']) ? (int) $payload['target_dimension'] : 0,
                'concurrency' => isset($payload['concurrency']) ? (int) $payload['concurrency'] : 0,
                'batch_size' => isset($payload['batch_size']) ? (int) $payload['batch_size'] : 0,
                'retry' => isset($payload['retry']) ? (int) $payload['retry'] : 0,
            ],
            $context->dataIsolation()
        ));
    }

    public function repairSourceBindings(Authenticatable $authorization, array $payload = []): array
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);
        return $this->knowledgeBaseAppClient->repairSourceBindings(KnowledgeBaseRequestDTO::forRepairSourceBindings(
            [
                'organization_codes' => array_values(array_map('strval', (array) ($payload['organization_codes'] ?? []))),
                'third_platform_type' => (string) ($payload['third_platform_type'] ?? 'teamshare'),
                'batch_size' => isset($payload['batch_size']) ? (int) $payload['batch_size'] : 0,
            ],
            $context->dataIsolation()
        ));
    }

    public function rebuildCleanup(Authenticatable $authorization, array $payload = []): array
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $context = KnowledgeBaseRawContextDTO::fromDataIsolation($dataIsolation);

        return $this->knowledgeBaseAppClient->rebuildCleanup(KnowledgeBaseRequestDTO::forRebuildCleanup(
            [
                'apply' => (bool) ($payload['apply'] ?? false),
                'force_delete_non_empty' => (bool) ($payload['force_delete_non_empty'] ?? false),
            ],
            $context->dataIsolation()
        ));
    }

    private function resolveKnowledgeEnabled(array $query): ?bool
    {
        if (array_key_exists('enabled', $query)) {
            return $query['enabled'] === null || $query['enabled'] === ''
                ? null
                : (bool) $query['enabled'];
        }

        if (! array_key_exists('search_type', $query) || $query['search_type'] === null || $query['search_type'] === '') {
            return null;
        }

        return match (SearchType::from((int) $query['search_type'])) {
            SearchType::ALL => null,
            SearchType::ENABLED => true,
            SearchType::DISABLED => false,
        };
    }
}
