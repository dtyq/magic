<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\ModelGateway\Entity\ApplicationEntity;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayOfficialApp;
use App\Domain\ModelGateway\Entity\ValueObject\Query\ApplicationQuery;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Qbhy\HyperfAuth\Authenticatable;

class ApplicationAppService extends AbstractLLMAppService
{
    /**
     * @return array{llm_application: ApplicationEntity, users: array<string, MagicUserEntity>, icons: array<string, FileLink>}
     */
    public function save(Authenticatable $authorization, ApplicationEntity $savingLLMApplicationEntity): array
    {
        $dataIsolation = $this->createLLMDataIsolation($authorization);
        $savingLLMApplicationEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $savingLLMApplicationEntity->setCreator($dataIsolation->getCurrentUserId());

        if (! $savingLLMApplicationEntity->shouldCreate()) {
            $LLMApplicationEntity = $this->applicationDomainService->show($this->createLLMDataIsolation($authorization), $savingLLMApplicationEntity->getId());
            if ($LLMApplicationEntity->getCreator() !== $authorization->getId()) {
                ExceptionBuilder::throw(GenericErrorCode::AccessDenied);
            }
        }
        if (ModelGatewayOfficialApp::isOfficialApp($savingLLMApplicationEntity->getCode())) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied);
        }

        $LLMApplication = $this->applicationDomainService->save($this->createLLMDataIsolation($authorization), $savingLLMApplicationEntity);
        $data['llm_application'] = $LLMApplication;
        $data['users'] = $this->magicUserDomainService->getByUserIds(
            ContactDataIsolation::simpleMake($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId()),
            [$LLMApplication->getCreator(), $LLMApplication->getModifier()]
        );
        $data['icons'] = $this->getIcons($dataIsolation->getCurrentOrganizationCode(), [$LLMApplication->getIcon()]);
        return $data;
    }

    /**
     * @return array{total: int, list: ApplicationEntity[], users: array<string, MagicUserEntity>, icons: array<string, FileLink>}
     */
    public function queries(Authenticatable $authorization, ApplicationQuery $query, Page $page): array
    {
        $dataIsolation = $this->createLLMDataIsolation($authorization);

        $query->setCreator($authorization->getId());
        $data = $this->applicationDomainService->queries($dataIsolation, $query, $page);

        $userIds = [];
        $iconPaths = [];
        foreach ($data['list'] as $LLMApplication) {
            $userIds[] = $LLMApplication->getCreator();
            $userIds[] = $LLMApplication->getModifier();
            $iconPaths[] = $LLMApplication->getIcon();
        }

        $data['users'] = $this->magicUserDomainService->getByUserIds(
            ContactDataIsolation::simpleMake($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId()),
            $userIds
        );
        $data['icons'] = $this->getIcons($dataIsolation->getCurrentOrganizationCode(), $iconPaths);

        return $data;
    }

    /**
     * @return array{llm_application: ApplicationEntity, users: array<string, MagicUserEntity>, icons: array<string, FileLink>}
     */
    public function show(Authenticatable $authorization, int $id): array
    {
        $dataIsolation = $this->createLLMDataIsolation($authorization);

        $LLMApplication = $this->applicationDomainService->show($this->createLLMDataIsolation($authorization), $id);
        if ($LLMApplication->getCreator() !== $authorization->getId()) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied);
        }
        $data['llm_application'] = $LLMApplication;
        $data['users'] = $this->magicUserDomainService->getByUserIds(
            ContactDataIsolation::simpleMake($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId()),
            [$LLMApplication->getCreator(), $LLMApplication->getModifier()]
        );
        $data['icons'] = $this->getIcons($dataIsolation->getCurrentOrganizationCode(), [$LLMApplication->getIcon()]);
        return $data;
    }

    public function destroy(Authenticatable $authorization, int $id): void
    {
        $LLMApplicationEntity = $this->applicationDomainService->show($this->createLLMDataIsolation($authorization), $id);
        if ($LLMApplicationEntity->getCreator() !== $authorization->getId()) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied);
        }
        $this->applicationDomainService->destroy($this->createLLMDataIsolation($authorization), $LLMApplicationEntity);
    }
}
