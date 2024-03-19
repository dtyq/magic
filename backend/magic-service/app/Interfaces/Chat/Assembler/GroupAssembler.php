<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\Assembler;

use App\Domain\Group\Entity\MagicGroupEntity;
use App\Domain\Group\Entity\MagicGroupUserEntity;
use App\Domain\Group\Entity\ValueObject\GroupStatusEnum;
use App\Domain\Group\Entity\ValueObject\GroupTypeEnum;

class GroupAssembler
{
    public static function getGroupEntity(array $group): MagicGroupEntity
    {
        $groupEntity = new MagicGroupEntity();
        $groupEntity->setId((string) $group['id']);
        $groupEntity->setGroupName($group['group_name']);
        $groupEntity->setGroupAvatar($group['group_avatar']);
        $groupEntity->setGroupNotice($group['group_notice']);
        $groupEntity->setGroupOwner($group['group_owner']);
        $groupEntity->setOrganizationCode($group['organization_code']);
        $groupEntity->setGroupTag($group['group_tag']);
        $groupEntity->setGroupType(GroupTypeEnum::from($group['group_type']));
        $groupEntity->setGroupStatus(GroupStatusEnum::from($group['group_status']));
        $groupEntity->setMemberLimit($group['member_limit']);
        return $groupEntity;
    }

    public static function getGroupUserEntity(array $groupUser): MagicGroupUserEntity
    {
        $groupUserEntity = new MagicGroupUserEntity();
        $groupUserEntity->setId($groupUser['id']);
        $groupUserEntity->setGroupId($groupUser['group_id']);
        $groupUserEntity->setUserId($groupUser['user_id']);
        $groupUserEntity->setUserRole($groupUser['user_role']);
        $groupUserEntity->setUserType($groupUser['user_type']);
        $groupUserEntity->setStatus($groupUser['status']);
        $groupUserEntity->setOrganizationCode($groupUser['organization_code']);
        return $groupUserEntity;
    }
}
