<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\Assembler;

use App\Domain\Permission\Entity\OrganizationAdminEntity;
use App\Interfaces\Permission\DTO\OrganizationAdminListResponseDTO;
use App\Interfaces\Permission\DTO\OrganizationAdminResponseDTO;

class OrganizationAdminAssembler
{
    /**
     * 将单个组织管理员实体转换为响应DTO.
     */
    public static function assembleSingle(OrganizationAdminEntity $entity): OrganizationAdminResponseDTO
    {
        $dto = new OrganizationAdminResponseDTO();
        $dto->setUserId($entity->getUserId());
        $dto->setUserName(''); // 需要从用户服务获取
        $dto->setAvatar(''); // 需要从用户服务获取
        $dto->setDepartmentName(''); // 需要从部门服务获取
        $dto->setGrantorUserName(''); // 需要从用户服务获取
        $dto->setGrantorUserAvatar(''); // 需要从用户服务获取
        $dto->setOperationTime($entity->getGrantedAt()?->format('Y-m-d H:i:s') ?? '');
        $dto->setIsOrganizationCreator($entity->isOrganizationCreator());

        return $dto;
    }

    /**
     * 将组织管理员实体列表转换为响应DTO.
     *
     * @param OrganizationAdminEntity[] $entities
     */
    public static function assembleList(array $entities): OrganizationAdminListResponseDTO
    {
        $listDto = new OrganizationAdminListResponseDTO();

        foreach ($entities as $entity) {
            $dto = self::assembleSingle($entity);
            $listDto->addOrganizationAdmin($dto);
        }

        return $listDto;
    }

    /**
     * 将带有用户信息的数据转换为响应DTO.
     *
     * @param array $data 包含组织管理员实体和用户信息的数组
     */
    public static function assembleWithUserInfo(array $data): OrganizationAdminResponseDTO
    {
        $entity = $data['organization_admin'];
        $userInfo = $data['user_info'] ?? [];
        $grantorInfo = $data['grantor_info'] ?? [];
        $departmentInfo = $data['department_info'] ?? [];

        $dto = new OrganizationAdminResponseDTO();
        $dto->setId((string) $entity->getId());
        $dto->setUserId($entity->getUserId());
        $dto->setUserName($userInfo['nickname'] ?? '');
        $dto->setAvatar($userInfo['avatar_url'] ?? '');
        $dto->setDepartmentName($departmentInfo['name'] ?? '');
        $dto->setGrantorUserName($grantorInfo['nickname'] ?? '');
        $dto->setGrantorUserAvatar($grantorInfo['avatar_url'] ?? '');
        $dto->setOperationTime($entity->getGrantedAt()?->format('Y-m-d H:i:s') ?? '');
        $dto->setIsOrganizationCreator($entity->isOrganizationCreator());

        return $dto;
    }

    /**
     * 将带有用户信息的数据列表转换为响应DTO.
     *
     * @param array $dataList 包含组织管理员实体和用户信息的数组列表
     */
    public static function assembleListWithUserInfo(array $dataList): OrganizationAdminListResponseDTO
    {
        $listDto = new OrganizationAdminListResponseDTO();

        foreach ($dataList as $data) {
            $dto = self::assembleWithUserInfo($data);
            $listDto->addOrganizationAdmin($dto);
        }

        return $listDto;
    }
}
