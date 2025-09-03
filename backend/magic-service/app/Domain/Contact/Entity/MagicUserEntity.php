<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity;

use App\Domain\Agent\Entity\MagicAgentVersionEntity;
use App\Domain\Contact\Entity\Item\UserExtra;
use App\Domain\Contact\Entity\ValueObject\UserStatus;
use App\Domain\Contact\Entity\ValueObject\UserType;
use ArrayAccess;
use Hyperf\Codec\Json;

class MagicUserEntity extends AbstractEntity implements ArrayAccess
{
    protected ?int $id = null;

    protected string $magicId;

    protected string $organizationCode;

    protected string $userId;

    protected UserType $userType;

    protected string $description = '';

    protected string $likeNum = '0';

    protected string $label = '';

    protected UserStatus $status;

    protected string $nickname;

    protected string $avatarUrl;

    protected string $userManual = '';

    protected string $i18nName = '';

    protected string $createdAt = '';

    protected string $updatedAt = '';

    protected ?string $deletedAt = null;

    protected ?int $option = null;

    protected ?UserExtra $extra;

    private string $friendNum = '0';

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function getOption(): ?int
    {
        return $this->option;
    }

    public function setOption(?int $option): void
    {
        $this->option = $option;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(string $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?string $deletedAt): void
    {
        $this->deletedAt = $deletedAt;
    }

    public function getI18nName(): string
    {
        return $this->i18nName;
    }

    public function setI18nName(string $i18nName): void
    {
        $this->i18nName = $i18nName;
    }

    public function getUserManual(): string
    {
        return $this->userManual;
    }

    public function setUserManual(string $userManual): void
    {
        $this->userManual = $userManual;
    }

    public function getMagicId(): string
    {
        return $this->magicId;
    }

    public function setMagicId(int|string $magicId): void
    {
        if (is_int($magicId)) {
            $magicId = (string) $magicId;
        }
        $this->magicId = $magicId;
    }

    public function getUserId(): string
    {
        return $this->userId ?? '';
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getUserType(): UserType
    {
        return $this->userType;
    }

    public function setUserType(int|string|UserType $userType): void
    {
        if (is_numeric($userType)) {
            $this->userType = UserType::from((int) $userType);
            return;
        }
        $this->userType = $userType;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getStatus(): UserStatus
    {
        return $this->status;
    }

    public function setStatus(int|string|UserStatus $status): void
    {
        if (is_numeric($status)) {
            $this->status = UserStatus::from((int) $status);
            return;
        }
        $this->status = $status;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getLabel(): string
    {
        return $this->label ?? '';
    }

    public function setLabel(string $label): void
    {
        $this->label = $label;
    }

    public function getLikeNum(): string
    {
        return $this->likeNum;
    }

    public function setLikeNum(int|string $likeNum): void
    {
        if (! empty($likeNum) && $likeNum > 999) {
            $num = '999+';
        } else {
            $num = (string) $likeNum;
        }

        $this->likeNum = $num;
    }

    public function getFriendNum(): string
    {
        return $this->friendNum;
    }

    public function setFriendNum(int $friendNum): void
    {
        $this->friendNum = (string) $friendNum;
    }

    public function getNickname(): string
    {
        return $this->nickname;
    }

    public function setNickname(string $nickname): void
    {
        $this->nickname = $nickname;
    }

    public function getDescription(): string
    {
        return $this->description ?? '';
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
    }

    public function getAvatarUrl(): string
    {
        return $this->avatarUrl;
    }

    public function setAvatarUrl(string $avatarUrl): void
    {
        $this->avatarUrl = $avatarUrl;
    }

    public function getExtra(): ?UserExtra
    {
        return $this->extra ?? null;
    }

    public function setExtra(null|array|string|UserExtra $extra): void
    {
        if (empty($extra)) {
            $this->extra = null;
            return;
        }
        if (is_string($extra)) {
            $extraData = Json::decode($extra);
            $extra = new UserExtra($extraData);
        }
        if (is_array($extra)) {
            $extra = new UserExtra($extra);
        }
        $this->extra = $extra;
    }

    public static function fromMagicAgentVersionEntity(MagicAgentVersionEntity $magicAgentVersionEntity): MagicUserEntity
    {
        $avatarUrl = $magicAgentVersionEntity->getAgentAvatar();
        $nickName = $magicAgentVersionEntity->getAgentName();
        $description = $magicAgentVersionEntity->getAgentDescription();
        $userDTO = new MagicUserEntity();
        $userDTO->setAvatarUrl($avatarUrl);
        $userDTO->setNickName($nickName);
        $userDTO->setDescription($description);
        return $userDTO;
    }
}
