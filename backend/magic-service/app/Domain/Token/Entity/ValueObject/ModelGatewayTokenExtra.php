<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Token\Entity\ValueObject;

use App\Domain\Token\Repository\Facade\MagicTokenExtraInterface;
use App\Infrastructure\Core\AbstractDTO;
use Hyperf\Codec\Json;

class ModelGatewayTokenExtra extends AbstractDTO implements MagicTokenExtraInterface
{
    public const string MODEL_GATEWAY_AUDIENCE = 'model_gateway';

    protected ?int $magicEnvId = null;

    protected ?string $userId = null;

    protected ?string $audience = null;

    protected ?int $targetTokenType = null;

    /**
     * 说明：
     * 该 Extra 用于模型网关用户 token / refresh token 场景，支持从 DB 的 extra 字段（string JSON / array / null）直接构造，
     * 以便在 Repository 层按 TokenType 做最小化解析，不必做一个“大而全”的 Extra。
     */
    public function __construct(null|array|string $extra = null)
    {
        parent::__construct();

        if (is_string($extra) && $extra !== '') {
            $extra = Json::decode($extra);
        }

        if (empty($extra) || ! is_array($extra)) {
            return;
        }

        $this->setTokenExtraData($extra);
    }

    public function getMagicEnvId(): ?int
    {
        return $this->magicEnvId;
    }

    public function setMagicEnvId(?int $magicEnvId): void
    {
        $this->magicEnvId = $magicEnvId;
    }

    public function getUserId(): ?string
    {
        return $this->userId;
    }

    public function setUserId(?string $userId): void
    {
        $this->userId = $userId;
    }

    public function getAudience(): ?string
    {
        return $this->audience;
    }

    public function setAudience(?string $audience): void
    {
        $this->audience = $audience;
    }

    public function getTargetTokenType(): ?int
    {
        return $this->targetTokenType;
    }

    public function setTargetTokenType(null|int|string $targetTokenType): void
    {
        if ($targetTokenType === null || $targetTokenType === '') {
            $this->targetTokenType = null;
            return;
        }

        if (is_int($targetTokenType) || is_numeric($targetTokenType)) {
            $this->targetTokenType = (int) $targetTokenType;
            return;
        }

        $enum = MagicTokenType::getCaseFromName($targetTokenType);
        $this->targetTokenType = $enum?->value;
    }

    public function isModelGatewayRefreshForType(MagicTokenType $targetType): bool
    {
        return $this->audience === self::MODEL_GATEWAY_AUDIENCE
            && $this->targetTokenType === $targetType->value;
    }

    public function setTokenExtraData(array $extraData): self
    {
        if (isset($extraData['magic_env_id'])) {
            $this->setMagicEnvId((int) $extraData['magic_env_id']);
        }
        if (isset($extraData['user_id'])) {
            $this->userId = (string) $extraData['user_id'];
        }
        if (isset($extraData['audience'])) {
            $this->audience = (string) $extraData['audience'];
        }
        if (isset($extraData['target_token_type'])) {
            $this->setTargetTokenType($extraData['target_token_type']);
        }
        return $this;
    }

    public function toArray(): array
    {
        $data = [];
        if ($this->magicEnvId !== null) {
            $data['magic_env_id'] = $this->magicEnvId;
        }
        if ($this->userId !== null) {
            $data['user_id'] = $this->userId;
        }
        if ($this->audience !== null) {
            $data['audience'] = $this->audience;
        }
        if ($this->targetTokenType !== null) {
            $data['target_token_type'] = $this->targetTokenType;
        }
        return $data;
    }
}
