<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\Assembler;

use App\Application\Provider\DTO\AiAbilityDetailDTO;
use App\Application\Provider\DTO\AiAbilityListDTO;
use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Infrastructure\Util\Aes\AesUtil;
use Hyperf\Codec\Json;

use function Hyperf\Config\config;

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
        // 获取原始配置
        $config = $entity->getConfig();

        // 递归脱敏所有 api_key 字段（支持任意嵌套结构）
        $maskedConfig = self::maskConfigRecursively($config);

        return new AiAbilityDetailDTO(
            id: $entity->getId() ?? 0,
            code: $entity->getCode()->value,
            name: $entity->getLocalizedName($locale),
            description: $entity->getLocalizedDescription($locale),
            icon: $entity->getIcon(),
            sortOrder: $entity->getSortOrder(),
            status: $entity->getStatus()->value,
            config: $maskedConfig,
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
     * 对配置数据进行解密.
     *
     * @param string $config 加密的配置字符串
     * @param string $salt 盐值(通常是记录ID)
     * @return array 解密后的配置数组
     */
    public static function decodeConfig(string $config, string $salt): array
    {
        $decode = AesUtil::decode(self::_getAesKey($salt), $config);
        if (! $decode) {
            return [];
        }
        return Json::decode($decode);
    }

    /**
     * 对配置数据进行编码(JSON编码 + AES加密).
     *
     * @param array $config 配置数组
     * @param string $salt 盐值(通常是记录ID)
     * @return string 加密后的配置字符串
     */
    public static function encodeConfig(array $config, string $salt): string
    {
        $jsonEncoded = Json::encode($config);
        return AesUtil::encode(self::_getAesKey($salt), $jsonEncoded);
    }

    /**
     * 递归脱敏配置中的所有 api_key 字段.
     *
     * @param array $config 配置数组
     * @return array 脱敏后的配置数组
     */
    private static function maskConfigRecursively(array $config): array
    {
        $result = [];

        foreach ($config as $key => $value) {
            // 如果是 api_key 字段，进行脱敏（前4后4）
            if ($key === 'api_key' && is_string($value) && ! empty($value)) {
                $result[$key] = self::maskApiKey($value);
            }
            // 如果是数组，递归处理
            elseif (is_array($value)) {
                $result[$key] = self::maskConfigRecursively($value);
            }
            // 其他值直接赋值
            else {
                $result[$key] = $value;
            }
        }

        return $result;
    }

    /**
     * 脱敏 API Key.
     *
     * @param string $apiKey 原始 API Key
     * @param int $prefixLength 保留前几位（默认3）
     * @param int $suffixLength 保留后几位（默认3）
     * @return string 脱敏后的 API Key
     */
    private static function maskApiKey(string $apiKey, int $prefixLength = 4, int $suffixLength = 4): string
    {
        $length = mb_strlen($apiKey);
        $minLength = $prefixLength + $suffixLength;

        // 如果 key 太短，全部脱敏
        if ($length <= $minLength) {
            return str_repeat('*', $length);
        }

        // 显示前N位和后N位
        $prefix = mb_substr($apiKey, 0, $prefixLength);
        $suffix = mb_substr($apiKey, -$suffixLength);
        $maskLength = $length - $minLength;

        return $prefix . str_repeat('*', $maskLength) . $suffix;
    }

    /**
     * 生成AES加密密钥(基础密钥 + 盐值).
     *
     * @param string $salt 盐值
     * @return string AES密钥
     */
    private static function _getAesKey(string $salt): string
    {
        return config('abilities.ai_ability_aes_key') . $salt;
    }
}
