<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\Assembler;

use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderTemplateId;
use InvalidArgumentException;

/**
 * 服务商模板ID处理工具类
 * 用于生成和解析服务商模板ID（使用固定的数值型字符串）.
 */
class ProviderConfigIdAssembler
{
    /**
     * 根据ProviderCode和Category生成服务商模板的config_id.
     */
    public static function generateProviderTemplate(ProviderCode $providerCode, Category $category): string
    {
        $templateId = ProviderTemplateId::fromProviderCodeAndCategory($providerCode, $category);
        if ($templateId === null) {
            throw new InvalidArgumentException("Unsupported provider code and category combination: {$providerCode->value} + {$category->value}");
        }

        return $templateId->value;
    }

    /**
     * 检查给定的配置ID是否为任何服务商的模板.
     * 支持数值型字符串格式的模板ID.
     */
    public static function isAnyProviderTemplate(null|int|string $configId): bool
    {
        return self::parseProviderTemplate($configId) !== null;
    }

    /**
     * 根据模板配置ID解析出ProviderCode和Category.
     * 支持数值型字符串格式的模板ID.
     * @return null|array{providerCode: ProviderCode, category: Category}
     */
    public static function parseProviderTemplate(null|int|string $configId): ?array
    {
        if ($configId === null) {
            return null;
        }

        $configIdStr = (string) $configId;
        $templateId = ProviderTemplateId::tryFrom($configIdStr);

        if ($templateId === null) {
            return null;
        }

        return $templateId->toProviderCodeAndCategory();
    }

    /**
     * 根据ProviderTemplateId获取对应的数值型字符串.
     */
    public static function getTemplateIdValue(ProviderTemplateId $templateId): string
    {
        return $templateId->value;
    }

    /**
     * 根据数值型字符串获取对应的ProviderTemplateId.
     */
    public static function getTemplateIdFromValue(null|int|string $configId): ?ProviderTemplateId
    {
        if ($configId === null) {
            return null;
        }

        $configIdStr = (string) $configId;
        return ProviderTemplateId::tryFrom($configIdStr);
    }
}
