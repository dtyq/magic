<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Entity\ValueObject\Visibility;

use App\Domain\Agent\Entity\AbstractEntity;

class VisibilityConfig extends AbstractEntity
{
    protected int $visibilityType = 1;

    protected array $users = [];

    protected array $departments = [];

    public function getVisibilityType(): int
    {
        return $this->visibilityType;
    }

    public function setVisibilityType(int $visibilityType): void
    {
        $this->visibilityType = $visibilityType;
    }

    /**
     * @return User[]
     */
    public function getUsers(): array
    {
        return $this->users;
    }

    public function setUsers(array $users): void
    {
        $userData = [];
        foreach ($users as $user) {
            $userData[] = new User($user);
        }
        $this->users = $userData;
    }

    public function addUser(User $user): void
    {
        $this->users[] = $user;
    }

    /**
     * @return Department[]
     */
    public function getDepartments(): array
    {
        return $this->departments;
    }

    public function setDepartments(array $departments): void
    {
        $departmentData = [];
        foreach ($departments as $department) {
            $departmentData[] = new Department($department);
        }
        $this->departments = $departmentData;
    }
}
