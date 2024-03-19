<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Authentication\Assembler;

use App\Domain\Token\Entity\MagicTokenEntity;
use App\Interfaces\Authentication\DTO\PersonalAccessTokenDTO;

class PersonalAccessTokenAssembler
{
    /**
     * Entity 转 DTO.
     *
     * @param bool $maskToken 是否脱敏（查询时传 true，创建/重置时传 false）
     */
    public static function toDTO(?MagicTokenEntity $entity, bool $maskToken = false): PersonalAccessTokenDTO
    {
        $dto = new PersonalAccessTokenDTO();
        if ($entity === null) {
            $dto->setHasToken(false);
            return $dto;
        }
        $dto->setHasToken(true);
        $dto->setToken($maskToken ? self::maskToken($entity->getToken()) : $entity->getToken());
        $dto->setCreatedAt($entity->getCreatedAt());
        $dto->setExpiredAt($entity->getExpiredAt() ?? '');
        return $dto;
    }

    private static function maskToken(string $token): string
    {
        if (str_starts_with($token, 'pat_') && strlen($token) > 16) {
            $randomPart = substr($token, 4);
            return 'pat_' . substr($randomPart, 0, 8) . '****' . substr($randomPart, -4);
        }
        return '****';
    }
}
