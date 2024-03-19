<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity;

use App\Domain\Chat\DTO\UserGroupConversationQueryDTO;
use App\Domain\Chat\Entity\Items\ConversationExtra;
use App\Domain\Chat\Entity\ValueObject\ConversationStatus;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use Hyperf\Codec\Json;

/**
 * 会话,一个用户在不同组织下的会话是不同的.
 */
final class MagicConversationEntity extends AbstractEntity
{
    protected string $id = '';

    protected string $userId = '';

    protected string $userOrganizationCode = '';

    protected ConversationType $receiveType;

    protected string $receiveId = '';

    protected string $receiveOrganizationCode = '';

    protected int $isNotDisturb = 0;

    protected int $isTop = 0;

    protected int $isMark = 0;

    protected ?ConversationExtra $extra = null;

    protected ?string $createdAt = null;

    protected ?string $updatedAt = null;

    protected ?string $deletedAt = null;

    protected ?ConversationStatus $status = null;

    protected ?array $translateConfig = [];

    protected ?array $instructs = [];

    public function __construct(?array $data = [])
    {
        parent::__construct($data);
    }

    public function getStatus(): ?ConversationStatus
    {
        return $this->status;
    }

    public function setStatus(null|ConversationStatus|int $status): void
    {
        if (is_int($status)) {
            $status = ConversationStatus::tryFrom($status);
        }
        $this->status = $status;
    }

    public function getExtra(): ?ConversationExtra
    {
        return $this->extra;
    }

    public function setExtra(null|ConversationExtra|string $extra): void
    {
        if (is_string($extra) && ! empty($extra)) {
            $extraData = Json::decode($extra);
            $extra = new ConversationExtra($extraData);
        }
        if (empty($extra)) {
            $extra = null;
        }
        $this->extra = $extra;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        if (is_int($id)) {
            $id = (string) $id;
        }
        $this->id = $id;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getUserOrganizationCode(): string
    {
        return $this->userOrganizationCode;
    }

    public function setUserOrganizationCode(string $userOrganizationCode): void
    {
        $this->userOrganizationCode = $userOrganizationCode;
    }

    /**
     * 判断receiveType是否存在.
     */
    public function hasReceiveType(): bool
    {
        return isset($this->receiveType);
    }

    public function getReceiveType(): ConversationType
    {
        return $this->receiveType;
    }

    public function setReceiveType(ConversationType|int $receiveType): void
    {
        if (is_int($receiveType)) {
            $receiveType = ConversationType::from($receiveType);
        }
        $this->receiveType = $receiveType;
    }

    public function getReceiveId(): string
    {
        return $this->receiveId;
    }

    public function setReceiveId(string $receiveId): void
    {
        $this->receiveId = $receiveId;
    }

    public function getReceiveOrganizationCode(): string
    {
        return $this->receiveOrganizationCode;
    }

    public function setReceiveOrganizationCode(string $receiveOrganizationCode): void
    {
        $this->receiveOrganizationCode = $receiveOrganizationCode;
    }

    public function getIsNotDisturb(): int
    {
        return $this->isNotDisturb;
    }

    public function setIsNotDisturb(int $isNotDisturb): void
    {
        $this->isNotDisturb = $isNotDisturb;
    }

    public function getIsTop(): int
    {
        return $this->isTop;
    }

    public function setIsTop(int $isTop): void
    {
        $this->isTop = $isTop;
    }

    public function getIsMark(): int
    {
        return $this->isMark;
    }

    public function setIsMark(int $isMark): void
    {
        $this->isMark = $isMark;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?string $updatedAt): void
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

    public function getTranslateConfig(): ?array
    {
        return $this->translateConfig;
    }

    public function setTranslateConfig(null|array|string $translateConfig): void
    {
        $translateConfig = $this->transformJson($translateConfig);
        $this->translateConfig = $translateConfig;
    }

    public function getInstructs(): ?array
    {
        return $this->instructs;
    }

    public function setInstructs(null|array|string $instructs): void
    {
        $instructs = $this->transformJson($instructs);
        $this->instructs = $instructs;
    }

    public static function fromUserGroupConversationQueryDTO(UserGroupConversationQueryDTO $dto): MagicConversationEntity
    {
        $conversationEntity = new self();
        $conversationEntity->setUserId($dto->getUserId());
        $conversationEntity->setUserOrganizationCode($dto->getOrganizationCode());
        $conversationEntity->setReceiveType(ConversationType::Group);
        $conversationEntity->setReceiveId($dto->getGroupId());
        return $conversationEntity;
    }
}
