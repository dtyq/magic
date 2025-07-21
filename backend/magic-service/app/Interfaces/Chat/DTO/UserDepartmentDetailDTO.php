<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\DTO;

use App\Domain\Contact\Entity\ValueObject\EmployeeType;
use App\Domain\Contact\Entity\ValueObject\UserOption;
use App\Infrastructure\Core\AbstractDTO;

class UserDepartmentDetailDTO extends AbstractDTO
{
    protected string $userId;

    protected string $magicId;

    protected string $organizationCode;

    protected int $userType;

    protected string $description;

    protected int $likeNum;

    protected string $label;

    protected int $status;

    protected string $nickname;

    protected string $avatarUrl;

    protected string $countryCode;

    protected string $phone;

    protected string $email;

    protected string $realName;

    protected string $jobTitle;

    protected int $employeeType;

    protected string $aiCode;

    protected ?UserOption $option = null;

    protected int $accountType;

    protected string $userManual;

    /**
     * 用户在多个部门时的部门信息，不包含完整路径。
     * @var array<DepartmentPathNodeDTO>
     */
    protected array $pathNodes;

    /**
     * @var array
     *            用户在多个部门时的部门信息，包含完整路径
     * @var null|array<string,DepartmentPathNodeDTO[]>
     */
    protected ?array $fullPathNodes;

    public function __construct(?array $data = null)
    {
        if (isset($data['option']) && is_numeric($data['option'])) {
            $data['option'] = UserOption::tryFrom((int) $data['option']);
        }
        parent::__construct($data);
    }

    public function getOption(): ?UserOption
    {
        return $this->option;
    }

    public function setOption(?UserOption $option): self
    {
        $this->option = $option;
        return $this;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): UserDepartmentDetailDTO
    {
        $this->userId = $userId;
        return $this;
    }

    public function getMagicId(): string
    {
        return $this->magicId;
    }

    public function setMagicId(string $magicId): UserDepartmentDetailDTO
    {
        $this->magicId = $magicId;
        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): UserDepartmentDetailDTO
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    public function getUserType(): int
    {
        return $this->userType;
    }

    public function setUserType(int $userType): UserDepartmentDetailDTO
    {
        $this->userType = $userType;
        return $this;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): UserDepartmentDetailDTO
    {
        $this->description = $description;
        return $this;
    }

    public function getLikeNum(): int
    {
        return $this->likeNum;
    }

    public function setLikeNum(int $likeNum): UserDepartmentDetailDTO
    {
        $this->likeNum = $likeNum;
        return $this;
    }

    public function getLabel(): string
    {
        return $this->label;
    }

    public function setLabel(string $label): UserDepartmentDetailDTO
    {
        $this->label = $label;
        return $this;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function setStatus(int $status): UserDepartmentDetailDTO
    {
        $this->status = $status;
        return $this;
    }

    public function getNickname(): string
    {
        return $this->nickname;
    }

    public function setNickname(string $nickname): UserDepartmentDetailDTO
    {
        $this->nickname = $nickname;
        return $this;
    }

    public function getAvatarUrl(): string
    {
        return $this->avatarUrl;
    }

    public function setAvatarUrl(string $avatarUrl): UserDepartmentDetailDTO
    {
        $this->avatarUrl = $avatarUrl;
        return $this;
    }

    public function getCountryCode(): string
    {
        return $this->countryCode;
    }

    public function setCountryCode(string $countryCode): UserDepartmentDetailDTO
    {
        $this->countryCode = $countryCode;
        return $this;
    }

    public function getPhone(): string
    {
        return $this->phone;
    }

    public function setPhone(string $phone): UserDepartmentDetailDTO
    {
        $this->phone = $phone;
        return $this;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function setEmail(string $email): UserDepartmentDetailDTO
    {
        $this->email = $email;
        return $this;
    }

    public function getRealName(): string
    {
        return $this->realName;
    }

    public function setRealName(string $realName): UserDepartmentDetailDTO
    {
        $this->realName = $realName;
        return $this;
    }

    public function getEmployeeType(): int
    {
        return $this->employeeType;
    }

    public function setEmployeeType(EmployeeType|int $employeeType): UserDepartmentDetailDTO
    {
        if ($employeeType instanceof EmployeeType) {
            $employeeType = $employeeType->value;
        }
        $this->employeeType = $employeeType;
        return $this;
    }

    public function getAiCode(): string
    {
        return $this->aiCode;
    }

    public function setAiCode(string $aiCode): UserDepartmentDetailDTO
    {
        $this->aiCode = $aiCode;
        return $this;
    }

    public function getJobTitle(): string
    {
        return $this->jobTitle;
    }

    public function setJobTitle(string $jobTitle): UserDepartmentDetailDTO
    {
        $this->jobTitle = $jobTitle;
        return $this;
    }

    public function getPathNodes(): array
    {
        return $this->pathNodes ?? [];
    }

    public function setPathNodes(array $pathNodes): UserDepartmentDetailDTO
    {
        foreach ($pathNodes as &$pathNode) {
            if (is_array($pathNode)) {
                $pathNode = new DepartmentPathNodeDTO($pathNode);
            }
        }
        unset($pathNode);
        $this->pathNodes = $pathNodes;
        return $this;
    }

    public function addPathNode(array $pathNode): UserDepartmentDetailDTO
    {
        $this->pathNodes[] = new DepartmentPathNodeDTO($pathNode);
        return $this;
    }

    public function getAccountType(): int
    {
        return $this->accountType;
    }

    public function setAccountType(int $accountType): UserDepartmentDetailDTO
    {
        $this->accountType = $accountType;
        return $this;
    }

    public function getUserManual(): string
    {
        return $this->userManual;
    }

    public function setUserManual(string $userManual): UserDepartmentDetailDTO
    {
        $this->userManual = $userManual;
        return $this;
    }

    public function getFullPathNodes(): ?array
    {
        return $this->fullPathNodes ?? null;
    }

    /**
     * 用户在多个部门时的部门信息，包含完整路径。
     * @param array<string,array>|array<string,DepartmentPathNodeDTO[]> $fullPathNodes
     */
    public function setFullPathNodes(array $fullPathNodes): UserDepartmentDetailDTO
    {
        foreach ($fullPathNodes as $key => $value) {
            $this->fullPathNodes[$key] = array_map(function ($pathNode) {
                if (is_array($pathNode)) {
                    return new DepartmentPathNodeDTO($pathNode);
                }
                if ($pathNode instanceof DepartmentPathNodeDTO) {
                    return $pathNode;
                }
                return null;
            }, $value);
        }
        return $this;
    }
}
