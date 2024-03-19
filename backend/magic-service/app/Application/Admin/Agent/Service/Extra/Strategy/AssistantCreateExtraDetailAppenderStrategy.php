<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Admin\Agent\Service\Extra\Strategy;

use App\Application\Chat\Service\MagicDepartmentAppService;
use App\Application\Chat\Service\MagicUserContactAppService;
use App\Domain\Admin\Entity\ValueObject\Item\Member\MemberType;
use App\Domain\Contact\DTO\DepartmentQueryDTO;
use App\Domain\Contact\DTO\UserQueryDTO;
use App\Interfaces\Admin\DTO\Extra\AssistantCreateExtraDTO;
use App\Interfaces\Admin\DTO\Extra\SettingExtraDTOInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\DTO\UserDepartmentDetailDTO;
use App\Interfaces\Chat\DTO\UserDetailDTO;
use InvalidArgumentException;

class AssistantCreateExtraDetailAppenderStrategy implements ExtraDetailAppenderStrategyInterface
{
    public function appendExtraDetail(SettingExtraDTOInterface $extraDTO, MagicUserAuthorization $userAuthorization): SettingExtraDTOInterface
    {
        if (! $extraDTO instanceof AssistantCreateExtraDTO) {
            throw new InvalidArgumentException('Expected AssistantCreateExtraDTO');
        }

        $this->appendSelectedMembersInfo($extraDTO, $userAuthorization);

        return $extraDTO;
    }

    public function appendSelectedMembersInfo(AssistantCreateExtraDTO $extraDTO, MagicUserAuthorization $userAuthorization): self
    {
        $selectedMembers = $extraDTO->getSelectedMembers();
        $users = [];
        $departments = [];
        foreach ($selectedMembers as $selectedMember) {
            $memberId = $selectedMember->getMemberId();
            $memberType = $selectedMember->getMemberType();
            switch ($memberType) {
                case MemberType::USER:
                    $users[$memberId] = null;
                    break;
                case MemberType::DEPARTMENT:
                    $departments[$memberId] = null;
                    break;
            }
        }
        $queryDTO = new UserQueryDTO();
        $queryDTO->setUserIds(array_keys($users));
        /** @var UserDepartmentDetailDTO[]|UserDetailDTO[] $users */
        $users = $this->getMagicUserContactAppService()->getUserDetailByIds($queryDTO, $userAuthorization)['items'] ?? [];
        $users = array_column($users, null, 'user_id');
        $queryDTO = (new DepartmentQueryDTO())->setDepartmentIds(array_keys($departments));
        $departments = $this->getMagicDepartmentAppService()->getDepartmentByIds($queryDTO, $userAuthorization);
        $departments = array_column($departments, null, 'department_id');

        foreach ($selectedMembers as $selectedMember) {
            $memberId = $selectedMember->getMemberId();
            $memberType = $selectedMember->getMemberType();
            $name = match ($memberType) {
                MemberType::USER => ($users[$memberId] ?? null)?->getRealName(),
                MemberType::DEPARTMENT => ($departments[$memberId] ?? null)?->getName(),
                default => null,
            };
            $avatar = match ($memberType) {
                MemberType::USER => ($users[$memberId] ?? null)?->getAvatarUrl(),
                default => null,
            };
            $selectedMember
                ->setAvatar($avatar)
                ->setName($name);
        }
        return $this;
    }

    public function getMagicUserContactAppService(): MagicUserContactAppService
    {
        return di(MagicUserContactAppService::class);
    }

    public function getMagicDepartmentAppService(): MagicDepartmentAppService
    {
        return di(MagicDepartmentAppService::class);
    }
}
