<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Contact\Service;

use App\Application\Contact\DTO\MagicUserOrganizationItemDTO;
use App\Application\Contact\DTO\MagicUserOrganizationListDTO;
use App\Application\Contact\Support\OrganizationProductResolver;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use App\Domain\OrganizationEnvironment\Service\OrganizationDomainService;
use App\Domain\Permission\Service\OrganizationAdminDomainService;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Di\Annotation\Inject;
use Throwable;

/**
 * 用户当前组织应用服务
 */
class MagicUserOrganizationAppService
{
    #[Inject]
    protected MagicUserDomainService $userDomainService;

    #[Inject]
    protected MagicUserSettingAppService $userSettingAppService;

    #[Inject]
    protected MagicOrganizationEnvDomainService $organizationEnvDomainService;

    #[Inject]
    protected OrganizationDomainService $organizationDomainService;

    #[Inject]
    protected OrganizationAdminDomainService $organizationAdminDomainService;

    #[Inject]
    protected OrganizationProductResolver $organizationProductResolver;

    /**
     * 获取用户当前组织代码
     */
    public function getCurrentOrganizationCode(string $magicId): ?array
    {
        return $this->userSettingAppService->getCurrentOrganizationDataByMagicId($magicId);
    }

    /**
     * 设置用户当前组织代码
     */
    public function setCurrentOrganizationCode(string $magicId, string $magicOrganizationCode): array
    {
        // 1. 查询用户是否在指定组织中
        $userOrganizations = $this->userDomainService->getUserOrganizationsByMagicId($magicId);
        if (! in_array($magicOrganizationCode, $userOrganizations, true)) {
            ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_EXIST);
        }

        // 2. 查询这个组织的相关信息：magic_organizations_environment
        $organizationEnvEntity = $this->organizationEnvDomainService->getOrganizationEnvironmentByMagicOrganizationCode($magicOrganizationCode);
        if (! $organizationEnvEntity) {
            ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_EXIST);
        }

        // 3. 保存 magic_organization_code，origin_organization_code，environment_id，切换时间
        $organizationData = [
            'magic_organization_code' => $magicOrganizationCode,
            'third_organization_code' => $organizationEnvEntity->getOriginOrganizationCode(),
            'environment_id' => $organizationEnvEntity->getEnvironmentId(),
            'switch_time' => time(),
        ];

        $this->userSettingAppService->saveCurrentOrganizationDataByMagicId($magicId, $organizationData);
        return $organizationData;
    }

    /**
     * 获取账号下可用组织列表（仅包含启用状态组织）。
     *
     * @throws Throwable
     */
    public function getOrganizationsByAuthorization(string $authorization): MagicUserOrganizationListDTO
    {
        $userDetails = $this->userDomainService->getUsersDetailByAccountFromAuthorization($authorization);
        if (empty($userDetails)) {
            return new MagicUserOrganizationListDTO();
        }

        $organizationUserMap = [];
        $magicId = null;
        foreach ($userDetails as $detail) {
            $organizationCode = $detail->getOrganizationCode();
            if ($organizationCode === '') {
                continue;
            }

            if (! isset($organizationUserMap[$organizationCode])) {
                $organizationUserMap[$organizationCode] = $detail->getUserId();
            }

            if ($magicId === null) {
                $magicId = $detail->getMagicId();
            }
        }

        if ($magicId === null || empty($organizationUserMap)) {
            return new MagicUserOrganizationListDTO();
        }

        $organizations = $this->organizationDomainService->getByCodes(array_keys($organizationUserMap));
        if (empty($organizations)) {
            return new MagicUserOrganizationListDTO();
        }

        $currentOrganizationData = $this->getCurrentOrganizationCode($magicId) ?? [];
        $currentOrganizationCode = $currentOrganizationData['magic_organization_code'] ?? null;

        $listDTO = new MagicUserOrganizationListDTO();
        foreach ($organizations as $organizationCode => $organizationEntity) {
            if ($organizationEntity === null || ! $organizationEntity->isNormal()) {
                continue;
            }

            $userId = $organizationUserMap[$organizationCode] ?? null;
            if ($userId === null || $userId === '') {
                continue;
            }

            $dataIsolation = DataIsolation::create($organizationCode, $userId);
            $isAdmin = $this->organizationAdminDomainService->isOrganizationAdmin($dataIsolation, $userId);
            $isCreator = $this->organizationAdminDomainService->isOrganizationCreator($dataIsolation, $userId);

            $item = new MagicUserOrganizationItemDTO([
                'magic_organization_code' => $organizationCode,
                'name' => $organizationEntity->getName(),
                'organization_type' => $organizationEntity->getType(),
                'logo' => $organizationEntity->getLogo(),
                'seats' => $organizationEntity->getSeats(),
                'is_current' => $organizationCode === $currentOrganizationCode,
                'is_admin' => $isAdmin,
                'is_creator' => $isCreator,
                'product_name' => $this->organizationProductResolver->resolveProductName($organizationCode, $userId) ?? '',
            ]);

            $listDTO->addItem($item);
        }

        return $listDTO;
    }
}
