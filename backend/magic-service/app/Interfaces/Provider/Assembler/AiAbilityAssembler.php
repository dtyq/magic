<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\Assembler;

use App\Application\Provider\DTO\AiAbilityDetailDTO;
use App\Application\Provider\DTO\AiAbilityListDTO;
use App\Domain\Provider\Entity\AiAbilityEntity;

/**
 * AI能力装配器.
 */
class AiAbilityAssembler
{
    /**
     * AI能力Entity转换为ListDTO.
     */
    public static function entityToListDTO(AiAbilityEntity $entity, string $locale = 'zh_CN'): AiAbilityListDTO
    {
        return new AiAbilityListDTO(
            id: (string) ($entity->getId()),
            code: $entity->getCode()->value,
            name: $entity->getLocalizedName($locale),
            description: $entity->getLocalizedDescription($locale),
            status: $entity->getStatus()->value,
        );
    }

    /**
     * AI能力Entity转换为DetailDTO.
     */
    public static function entityToDetailDTO(AiAbilityEntity $entity, string $locale = 'zh_CN'): AiAbilityDetailDTO
    {
        $config = $entity->getConfig()->toArray();

        // 脱敏 api_key：只显示前4位和后4位
        if (isset($config['api_key']) && ! empty($config['api_key'])) {
            $config['api_key'] = self::maskApiKey($config['api_key']);
        }

        return new AiAbilityDetailDTO(
            id: $entity->getId() ?? 0,
            code: $entity->getCode()->value,
            name: $entity->getLocalizedName($locale),
            description: $entity->getLocalizedDescription($locale),
            icon: $entity->getIcon(),
            sortOrder: $entity->getSortOrder(),
            status: $entity->getStatus()->value,
            config: $config,
        );
    }

    /**
     * AI能力Entity列表转换为ListDTO列表.
     *
     * @param array<AiAbilityEntity> $entities
     * @return array<AiAbilityListDTO>
     */
    public static function entitiesToListDTOs(array $entities, string $locale = 'zh_CN'): array
    {
        $dtos = [];
        foreach ($entities as $entity) {
            $dtos[] = self::entityToListDTO($entity, $locale);
        }
        return $dtos;
    }

    /**
     * AI能力列表DTO转数组.
     *
     * @param array<AiAbilityListDTO> $dtos
     */
    public static function listDTOsToArray(array $dtos): array
    {
        $result = [];
        foreach ($dtos as $dto) {
            $result[] = $dto->toArray();
        }
        return $result;
    }

    /**
     * 脱敏 API Key.
     * 只显示前4位和后4位，中间用 * 代替
     */
    private static function maskApiKey(string $apiKey): string
    {
        $length = mb_strlen($apiKey);

        // 如果 key 太短，全部脱敏
        if ($length <= 8) {
            return str_repeat('*', $length);
        }

        // 显示前4位和后4位
        $prefix = mb_substr($apiKey, 0, 4);
        $suffix = mb_substr($apiKey, -4);
        $maskLength = $length - 8;

        return $prefix . str_repeat('*', $maskLength) . $suffix;
    }
}
