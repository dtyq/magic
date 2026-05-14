<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 协作者列表响应 DTO。
 */
class CollaboratorListResponseDTO extends AbstractDTO
{
    /**
     * @var CollaboratorListItemDTO[]
     */
    protected array $members = [];

    /**
     * 从协作者数据创建响应 DTO。
     */
    public static function fromMemberData(array $users, array $departments): self
    {
        $dto = new self();
        $members = [];

        foreach ($users as $userData) {
            $members[] = CollaboratorListItemDTO::fromUserData($userData);
        }

        foreach ($departments as $departmentData) {
            $members[] = CollaboratorListItemDTO::fromDepartmentData($departmentData);
        }

        $dto->setMembers($members);
        return $dto;
    }

    /**
     * 转为接口返回数组。
     */
    public function toArray(): array
    {
        $result = [];
        foreach ($this->members as $member) {
            $result[] = $member->toArray();
        }

        return [
            'members' => $result,
        ];
    }

    /**
     * @param CollaboratorListItemDTO[] $members
     */
    public function setMembers(array $members): self
    {
        $this->members = $members;
        return $this;
    }
}
