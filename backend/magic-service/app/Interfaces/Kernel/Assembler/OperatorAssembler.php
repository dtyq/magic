<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Kernel\Assembler;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Infrastructure\Core\Operator;
use App\Interfaces\Kernel\DTO\OperatorDTO;
use DateTime;

class OperatorAssembler
{
    public static function toDTO(Operator $operator): OperatorDTO
    {
        $dto = new OperatorDTO();
        $dto
            ->setUid($operator->getUid())
            ->setName($operator->getName())
            ->setTime($operator->getTime()->format('Y-m-d H:i:s'));
        return $dto;
    }

    public static function createOperatorDTOByUserEntity(?MagicUserEntity $user, null|DateTime|string $dateTime = null): ?OperatorDTO
    {
        if (! $user) {
            return null;
        }
        $time = '';
        $timeStamp = 0;
        if ($dateTime instanceof DateTime) {
            $time = $dateTime->format('Y-m-d H:i:s');
            $timeStamp = $dateTime->getTimestamp();
        } elseif (is_string($dateTime)) {
            $time = $dateTime;
            $timeStamp = strtotime($dateTime);
        }
        $operatorDTO = new OperatorDTO();
        $operatorDTO->setId($user->getUserId());
        $operatorDTO->setUid($user->getUserId());
        $operatorDTO->setName($user->getNickname());
        $operatorDTO->setAvatar($user->getAvatarUrl());
        $operatorDTO->setTime($time);
        $operatorDTO->setTimestamp($timeStamp);
        return $operatorDTO;
    }
}
