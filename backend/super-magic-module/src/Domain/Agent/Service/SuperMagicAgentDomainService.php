<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Service;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use DateTime;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\SuperMagicAgentQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentLimit;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\SuperMagicAgentRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Event\SuperMagicAgentSavedEvent;
use Dtyq\SuperMagic\Domain\Agent\Event\SuperMagicAgentDeletedEvent;
use Dtyq\SuperMagic\Domain\Agent\Event\SuperMagicAgentEnabledEvent;
use Dtyq\SuperMagic\Domain\Agent\Event\SuperMagicAgentDisabledEvent;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Dtyq\AsyncEvent\AsyncEventUtil;

readonly class SuperMagicAgentDomainService
{
    public function __construct(
        protected SuperMagicAgentRepositoryInterface $superMagicAgentRepository
    ) {
    }

    public function getByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?SuperMagicAgentEntity
    {
        return $this->superMagicAgentRepository->getByCode($dataIsolation, $code);
    }

    public function queries(SuperMagicAgentDataIsolation $dataIsolation, SuperMagicAgentQuery $query, Page $page): array
    {
        return $this->superMagicAgentRepository->queries($dataIsolation, $query, $page);
    }

    public function save(SuperMagicAgentDataIsolation $dataIsolation, SuperMagicAgentEntity $savingEntity): SuperMagicAgentEntity
    {
        $savingEntity->setCreator($dataIsolation->getCurrentUserId());
        $savingEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        
        $isCreate = $savingEntity->shouldCreate();
        
        if ($isCreate) {
            // 检查用户创建的智能体数量是否超过限制
            $currentCount = $this->superMagicAgentRepository->countByCreator($dataIsolation, $dataIsolation->getCurrentUserId());
            if ($currentCount >= SuperMagicAgentLimit::MAX_AGENTS_PER_USER) {
                ExceptionBuilder::throw(
                    SuperMagicErrorCode::AgentLimitExceeded, 
                    'super_magic.agent.limit_exceeded', 
                    ['limit' => SuperMagicAgentLimit::MAX_AGENTS_PER_USER]
                );
            }
            
            $entity = clone $savingEntity;
            $entity->prepareForCreation();
        } else {
            $entity = $this->superMagicAgentRepository->getByCode($dataIsolation, $savingEntity->getCode());
            if (! $entity) {
                ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $savingEntity->getCode()]);
            }
            $savingEntity->prepareForModification($entity);
        }

        $savedEntity = $this->superMagicAgentRepository->save($dataIsolation, $entity);
        
        // 触发保存事件
        AsyncEventUtil::dispatch(new SuperMagicAgentSavedEvent($savedEntity, $isCreate));
        
        return $savedEntity;
    }

    public function delete(SuperMagicAgentDataIsolation $dataIsolation, string $code): bool
    {
        // 验证实体是否存在
        $entity = $this->superMagicAgentRepository->getByCode($dataIsolation, $code);
        if (! $entity) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }

        $result = $this->superMagicAgentRepository->delete($dataIsolation, $code);
        
        if ($result) {
            // 触发删除事件
            AsyncEventUtil::dispatch(new SuperMagicAgentDeletedEvent($entity));
        }
        
        return $result;
    }

    public function enable(SuperMagicAgentDataIsolation $dataIsolation, string $code): SuperMagicAgentEntity
    {
        $entity = $this->getByCodeWithException($dataIsolation, $code);

        $entity->setEnabled(true);
        $entity->setModifier($dataIsolation->getCurrentUserId());
        $entity->setUpdatedAt(new DateTime());

        $savedEntity = $this->superMagicAgentRepository->save($dataIsolation, $entity);
        
        // 触发启用事件
        AsyncEventUtil::dispatch(new SuperMagicAgentEnabledEvent($savedEntity));
        
        return $savedEntity;
    }

    public function disable(SuperMagicAgentDataIsolation $dataIsolation, string $code): SuperMagicAgentEntity
    {
        $entity = $this->getByCodeWithException($dataIsolation, $code);

        $entity->setEnabled(false);
        $entity->setModifier($dataIsolation->getCurrentUserId());
        $entity->setUpdatedAt(new DateTime());

        $savedEntity = $this->superMagicAgentRepository->save($dataIsolation, $entity);
        
        // 触发禁用事件
        AsyncEventUtil::dispatch(new SuperMagicAgentDisabledEvent($savedEntity));
        
        return $savedEntity;
    }

    public function getByCodeWithException(SuperMagicAgentDataIsolation $dataIsolation, string $code): SuperMagicAgentEntity
    {
        $entity = $this->superMagicAgentRepository->getByCode($dataIsolation, $code);
        if (! $entity) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }
        return $entity;
    }
}
