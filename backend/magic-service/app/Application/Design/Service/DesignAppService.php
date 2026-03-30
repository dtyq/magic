<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Qbhy\HyperfAuth\Authenticatable;

abstract class DesignAppService extends AbstractKernelAppService
{
    protected function createDesignDataIsolation(Authenticatable|BaseDataIsolation $authorization): DesignDataIsolation
    {
        $dataIsolation = new DesignDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    protected function validateRoleHigherOrEqual(DesignDataIsolation $dataIsolation, ProjectEntity $projectEntity, MemberRole $requiredRole): void
    {
        // 如果是所有者，直接通过
        if ($projectEntity->getCreatedUid() === $dataIsolation->getCurrentUserId()) {
            return;
        }

        $projectMemberService = di(ProjectMemberDomainService::class);
        $magicDepartmentUserDomainService = di(MagicDepartmentUserDomainService::class);

        $projectMemberEntity = $projectMemberService->getMemberByProjectAndUser($projectEntity->getId(), $dataIsolation->getCurrentUserId());

        if ($projectMemberEntity && $projectMemberEntity->getRole()->isHigherOrEqualThan($requiredRole)) {
            return;
        }

        $contactDataIsolation = ContactDataIsolation::create($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId());
        $departmentIds = $magicDepartmentUserDomainService->getDepartmentIdsByUserId($contactDataIsolation, $dataIsolation->getCurrentUserId(), true);
        $projectMemberEntities = $projectMemberService->getMembersByProjectAndDepartmentIds($projectEntity->getId(), $departmentIds);

        foreach ($projectMemberEntities as $projectMemberEntity) {
            if ($projectMemberEntity->getRole()->isHigherOrEqualThan($requiredRole)) {
                return;
            }
        }
        ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
    }
}
