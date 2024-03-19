<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\ExecutionData;

use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use JetBrains\PhpStorm\ArrayShape;

class TriggerDataUserExtInfo
{
    private string $organizationCode;

    private string $userId;

    private string $nickname;

    private string $realName;

    private ?string $workNumber = null;

    private ?string $position = null;

    #[ArrayShape([['id' => 'string', 'name' => 'string', 'path' => 'string']])]
    private ?array $departments = null;

    public function __construct(string $organizationCode, string $userId, string $nickname = '', string $realName = '')
    {
        $this->organizationCode = $organizationCode;
        $this->userId = $userId;
        $this->nickname = $nickname;
        $this->realName = $realName;
    }

    public function setWorkNumber(?string $workNumber): void
    {
        $this->workNumber = $workNumber;
    }

    public function setPosition(?string $position): void
    {
        $this->position = $position;
    }

    public function setDepartments(?array $departments): void
    {
        $this->departments = $departments;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getNickname(): string
    {
        return $this->nickname;
    }

    public function getRealName(): string
    {
        return $this->realName;
    }

    public function getWorkNumber(): string
    {
        if (is_null($this->workNumber)) {
            $this->loadMagicUserDepartments();
        }
        return $this->workNumber;
    }

    public function getPosition(): string
    {
        if (is_null($this->position)) {
            $this->loadMagicUserDepartments();
        }
        return $this->position;
    }

    /**
     * @return array{array{id: string, name: string, path: string}}|array{}
     */
    public function getDepartments(): array
    {
        if (is_null($this->departments)) {
            $this->loadMagicUserDepartments();
        }
        return $this->departments;
    }

    /**
     * 加载 magic 的用户信息.
     */
    private function loadMagicUserDepartments(): void
    {
        $departmentDomain = di(MagicDepartmentDomainService::class);
        $departmentUserDomain = di(MagicDepartmentUserDomainService::class);

        $contactDataIsolation = ContactDataIsolation::create($this->organizationCode, $this->userId);
        // 获取用户的部门id
        $departmentUserEntities = $departmentUserDomain->getDepartmentUsersByUserIds([$this->userId], $contactDataIsolation);
        $departmentIds = array_column($departmentUserEntities, 'department_id');

        $departments = $departmentDomain->getDepartmentByIds($contactDataIsolation, $departmentIds, true);
        // 添加 path 去再查一次
        foreach ($departments as $department) {
            $pathDepartments = explode('/', $department->getPath());
            $departmentIds = array_merge($departmentIds, $pathDepartments);
        }
        $departmentIds = array_values(array_unique($departmentIds));
        $departments = $departmentDomain->getDepartmentByIds($contactDataIsolation, $departmentIds, true);

        $workNumber = '';
        $position = '';
        $departmentArray = [];
        foreach ($departmentUserEntities as $departmentUserEntity) {
            if (! $departmentEntity = $departments[$departmentUserEntity->getDepartmentId()] ?? null) {
                continue;
            }
            if ($workNumber === '' && $departmentUserEntity->getEmployeeNo() !== '') {
                $workNumber = $departmentUserEntity->getEmployeeNo();
            }
            if ($position === '' && $departmentUserEntity->getJobTitle() !== '') {
                $position = $departmentUserEntity->getJobTitle();
            }
            $pathNames = [];
            $pathDepartments = explode('/', $departmentEntity->getPath());
            foreach ($pathDepartments as $pathDepartmentId) {
                if (isset($departments[$pathDepartmentId]) && $departments[$pathDepartmentId]->getName() !== '') {
                    $pathNames[] = $departments[$pathDepartmentId]->getName();
                }
            }
            $departmentArray[] = [
                'id' => $departmentEntity->getDepartmentId(),
                'name' => $departmentEntity->getName(),
                'path' => implode('/', $pathNames),
            ];
        }

        $this->departments = $departmentArray;
        $this->workNumber = $workNumber;
        $this->position = $position;
    }
}
