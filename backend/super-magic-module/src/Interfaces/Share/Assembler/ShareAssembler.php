<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\Assembler;

use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareEntity;
use Dtyq\SuperMagic\Domain\Share\Service\ResourceShareDomainService;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Response\ShareItemDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Response\ShareItemWithPasswordDTO;

/**
 * 分享装配器
 * 负责将领域实体转换为不同类型的DTO.
 */
class ShareAssembler
{
    public function __construct(
        private ResourceShareDomainService $shareDomainService
    ) {
    }

    /**
     * 将分享实体转换为基础DTO.
     *
     * @param ResourceShareEntity $share 分享实体
     * @return ShareItemDTO 基础分享DTO
     */
    public function toDto(ResourceShareEntity $share): ShareItemDTO
    {
        $dto = new ShareItemDTO();
        $dto->id = (string) $share->getId();
        $dto->resourceId = $share->getResourceId();
        $dto->resourceType = $share->getResourceType();
        $dto->resourceTypeName = ResourceType::tryFrom($share->getResourceType())->name ?? '';
        $dto->shareCode = $share->getShareCode();
        $dto->hasPassword = ! empty($share->getPassword());
        $dto->shareType = $share->getShareType();

        return $dto;
    }

    /**
     * 将分享实体转换为带密码的DTO.
     *
     * @param ResourceShareEntity $share 分享实体
     * @return ShareItemWithPasswordDTO 带密码的分享DTO
     */
    public function toDtoWithPassword(ResourceShareEntity $share): ShareItemWithPasswordDTO
    {
        // 先创建基础DTO
        $baseDto = $this->toDto($share);

        // 获取解密后的密码
        $password = '';
        if ($baseDto->hasPassword) {
            $password = $this->shareDomainService->getDecryptedPassword($share);
        }

        // 创建带密码的DTO
        return ShareItemWithPasswordDTO::fromBaseDto($baseDto, $password);
    }
}
