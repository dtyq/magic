<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\DTO;

use App\Domain\Contact\Entity\ValueObject\UserOption;
use App\Infrastructure\Core\AbstractDTO;

class UserDetailDTO extends AbstractDTO
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

    protected string $phone;

    protected ?string $email = null;

    protected string $realName;

    protected int $accountType;

    protected string $aiCode;

    protected ?AgentInfoDTO $agentInfo = null;

    protected ?AgentInfoDTO $botInfo = null;

    protected string $userManual;

    protected string $countryCode;

    protected ?UserOption $option;

    public function __construct(array $data = [])
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

    public function setOption(?UserOption $option): void
    {
        $this->option = $option;
    }

    public function getCountryCode(): string
    {
        return $this->countryCode;
    }

    public function setCountryCode(string $countryCode): UserDetailDTO
    {
        $this->countryCode = $countryCode;
        return $this;
    }

    public function getUserManual(): string
    {
        return $this->userManual;
    }

    public function setUserManual(string $userManual): UserDetailDTO
    {
        $this->userManual = $userManual;
        return $this;
    }

    public function getAgentInfo(): AgentInfoDTO
    {
        return $this->agentInfo;
    }

    public function setAgentInfo(AgentInfoDTO $agentInfo): UserDetailDTO
    {
        $this->agentInfo = $agentInfo;
        $this->botInfo = $agentInfo;
        return $this;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): UserDetailDTO
    {
        $this->userId = $userId;
        return $this;
    }

    public function getMagicId(): string
    {
        return $this->magicId;
    }

    public function setMagicId(string $magicId): UserDetailDTO
    {
        $this->magicId = $magicId;
        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): UserDetailDTO
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    public function getUserType(): int
    {
        return $this->userType;
    }

    public function setUserType(int $userType): UserDetailDTO
    {
        $this->userType = $userType;
        return $this;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): UserDetailDTO
    {
        $this->description = $description;
        return $this;
    }

    public function getLikeNum(): int
    {
        return $this->likeNum;
    }

    public function setLikeNum(int|string $likeNum): UserDetailDTO
    {
        $this->likeNum = (int) $likeNum;
        return $this;
    }

    public function getLabel(): string
    {
        return $this->label;
    }

    public function setLabel(string $label): UserDetailDTO
    {
        $this->label = $label;
        return $this;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function setStatus(int $status): UserDetailDTO
    {
        $this->status = $status;
        return $this;
    }

    public function getNickname(): string
    {
        return $this->nickname;
    }

    public function setNickname(string $nickname): UserDetailDTO
    {
        $this->nickname = $nickname;
        return $this;
    }

    public function getAvatarUrl(): string
    {
        return $this->avatarUrl;
    }

    public function setAvatarUrl(string $avatarUrl): UserDetailDTO
    {
        $this->avatarUrl = $avatarUrl;
        return $this;
    }

    public function getPhone(): string
    {
        return $this->phone;
    }

    public function setPhone(string $phone): UserDetailDTO
    {
        $this->phone = $phone;
        return $this;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function setEmail(?string $email): UserDetailDTO
    {
        $this->email = $email;
        return $this;
    }

    public function getRealName(): string
    {
        return $this->realName;
    }

    public function setRealName(string $realName): UserDetailDTO
    {
        $this->realName = $realName;
        return $this;
    }

    public function getAccountType(): int
    {
        return $this->accountType;
    }

    public function setAccountType(int $accountType): UserDetailDTO
    {
        $this->accountType = $accountType;
        return $this;
    }

    public function getAiCode(): string
    {
        return $this->aiCode;
    }

    public function setAiCode(string $aiCode): UserDetailDTO
    {
        $this->aiCode = $aiCode;
        return $this;
    }
}
