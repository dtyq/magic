<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Asset\Initializer;

use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Service\AssetTagDomainService;
use Throwable;

class AssetSystemTagInitializer
{
    private const string SYSTEM_UID = 'system';

    /** @var array<int, array{name_i18n: array{default: string, zh_CN: string, en_US: string}, tags: array<int, array{default: string, zh_CN: string, en_US: string}>}> */
    private const array TAGS = [
        ['name_i18n' => ['default' => 'Gender', 'zh_CN' => '性别', 'en_US' => 'Gender'], 'tags' => [
            ['default' => 'Male', 'zh_CN' => '男性', 'en_US' => 'Male'], ['default' => 'Female', 'zh_CN' => '女性', 'en_US' => 'Female'], ['default' => 'Neutral', 'zh_CN' => '中性', 'en_US' => 'Neutral'],
        ]],
        ['name_i18n' => ['default' => 'Age Group', 'zh_CN' => '年龄段', 'en_US' => 'Age Group'], 'tags' => [
            ['default' => 'Child', 'zh_CN' => '儿童', 'en_US' => 'Child'], ['default' => 'Teenager', 'zh_CN' => '少年', 'en_US' => 'Teenager'], ['default' => 'Young Adult', 'zh_CN' => '青年', 'en_US' => 'Young Adult'], ['default' => 'Middle-aged', 'zh_CN' => '中年', 'en_US' => 'Middle-aged'], ['default' => 'Elderly', 'zh_CN' => '老年', 'en_US' => 'Elderly'],
        ]],
        ['name_i18n' => ['default' => 'Species', 'zh_CN' => '种族', 'en_US' => 'Species'], 'tags' => [
            ['default' => 'Human', 'zh_CN' => '人类', 'en_US' => 'Human'], ['default' => 'Elf', 'zh_CN' => '精灵', 'en_US' => 'Elf'], ['default' => 'Orc', 'zh_CN' => '兽人', 'en_US' => 'Orc'], ['default' => 'Mechanical', 'zh_CN' => '机械', 'en_US' => 'Mechanical'], ['default' => 'Other', 'zh_CN' => '其他', 'en_US' => 'Other'],
        ]],
        ['name_i18n' => ['default' => 'Era', 'zh_CN' => '时代', 'en_US' => 'Era'], 'tags' => [
            ['default' => 'Pre-Qin', 'zh_CN' => '先秦', 'en_US' => 'Pre-Qin'], ['default' => 'Ancient', 'zh_CN' => '古代', 'en_US' => 'Ancient'], ['default' => 'Early Modern', 'zh_CN' => '近代', 'en_US' => 'Early Modern'], ['default' => 'Modern', 'zh_CN' => '现代', 'en_US' => 'Modern'], ['default' => 'Future', 'zh_CN' => '未来', 'en_US' => 'Future'],
        ]],
        ['name_i18n' => ['default' => 'Cultural Region', 'zh_CN' => '文化区域', 'en_US' => 'Cultural Region'], 'tags' => [
            ['default' => 'East Asia', 'zh_CN' => '东亚', 'en_US' => 'East Asia'], ['default' => 'Europe and America', 'zh_CN' => '欧美', 'en_US' => 'Europe and America'], ['default' => 'Middle East', 'zh_CN' => '中东', 'en_US' => 'Middle East'], ['default' => 'Africa', 'zh_CN' => '非洲', 'en_US' => 'Africa'], ['default' => 'Fantasy', 'zh_CN' => '奇幻', 'en_US' => 'Fantasy'],
        ]],
        ['name_i18n' => ['default' => 'Body Type', 'zh_CN' => '体型', 'en_US' => 'Body Type'], 'tags' => [
            ['default' => 'Slim', 'zh_CN' => '瘦削', 'en_US' => 'Slim'], ['default' => 'Proportional', 'zh_CN' => '匀称', 'en_US' => 'Proportional'], ['default' => 'Athletic', 'zh_CN' => '健壮', 'en_US' => 'Athletic'], ['default' => 'Full', 'zh_CN' => '丰满', 'en_US' => 'Full'],
        ]],
        ['name_i18n' => ['default' => 'Hair Color', 'zh_CN' => '发色', 'en_US' => 'Hair Color'], 'tags' => [
            ['default' => 'Black Hair', 'zh_CN' => '黑发', 'en_US' => 'Black Hair'], ['default' => 'White Hair', 'zh_CN' => '白发', 'en_US' => 'White Hair'], ['default' => 'Blonde Hair', 'zh_CN' => '金发', 'en_US' => 'Blonde Hair'], ['default' => 'Brown Hair', 'zh_CN' => '棕发', 'en_US' => 'Brown Hair'], ['default' => 'Colorful Hair', 'zh_CN' => '彩色', 'en_US' => 'Colorful Hair'],
        ]],
    ];

    /** @return array{success: bool, message: string, count: int, groups: int, tags: int} */
    public static function init(): array
    {
        $organizationCode = trim((string) config('service_provider.office_organization', ''));
        if ($organizationCode === '') {
            return self::result(false, 'Official organization code not configured', 0, 0);
        }

        try {
            $result = di(AssetTagDomainService::class)->initializeSystemTags(new AssetDataIsolation($organizationCode, self::SYSTEM_UID), self::TAGS);
        } catch (Throwable $throwable) {
            return self::result(false, 'Failed to initialize asset system tags: ' . $throwable->getMessage(), 0, 0);
        }

        return self::result(true, sprintf('Successfully initialized asset system tags: %d groups, %d tags.', $result['groups'], $result['tags']), $result['groups'], $result['tags']);
    }

    /** @return array{success: bool, message: string, count: int, groups: int, tags: int} */
    private static function result(bool $success, string $message, int $groups, int $tags): array
    {
        return ['success' => $success, 'message' => $message, 'count' => $groups + $tags, 'groups' => $groups, 'tags' => $tags];
    }
}
