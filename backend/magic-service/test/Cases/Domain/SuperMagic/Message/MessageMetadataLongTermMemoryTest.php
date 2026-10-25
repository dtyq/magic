<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Message;

use App\Domain\SuperMagic\Message\Entity\ValueObject\MessageMetadata;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * 消息元数据个人偏好协议兼容测试.
 * @internal
 */
class MessageMetadataLongTermMemoryTest extends TestCase
{
    public function testInitMetadataDoesNotCarryRuntimePreference(): void
    {
        $metadata = new MessageMetadata(personalPreferences: null);

        $this->assertNull($metadata->getPersonalPreferences());
        $this->assertArrayNotHasKey('personal_preferences', $metadata->toArray());
    }

    public function testChatMetadataCarriesRuntimePreference(): void
    {
        $preferences = ['long_term_memory_enabled' => false];
        $metadata = new MessageMetadata(personalPreferences: $preferences);

        $this->assertSame($preferences, $metadata->getPersonalPreferences());
        $this->assertSame($preferences, $metadata->toArray()['personal_preferences']);
        $this->assertArrayNotHasKey('long_term_memory_enabled', $metadata->toArray());
    }

    /**
     * 验证通用个人偏好数组保持原始字段和值，不在 MessageMetadata 中解析具体语义.
     */
    #[DataProvider('personalPreferencesProvider')]
    public function testPersonalPreferencesRoundTrip(array $preferences): void
    {
        $metadata = MessageMetadata::fromArray(['personal_preferences' => $preferences]);

        $this->assertSame($preferences, $metadata->getPersonalPreferences());
        $this->assertSame($preferences, $metadata->toArray()['personal_preferences']);
    }

    /**
     * 提供个人偏好协议测试值.
     *
     * @return array<string, array{0: array<string, mixed>}>
     */
    public static function personalPreferencesProvider(): array
    {
        return [
            '长期记忆开启' => [['long_term_memory_enabled' => true]],
            '长期记忆关闭' => [['long_term_memory_enabled' => false]],
            '未来扩展字段' => [[
                'long_term_memory_enabled' => true,
                'future_preference' => 'value',
            ]],
            '具体字段非法值仍原样透传' => [['long_term_memory_enabled' => 'false']],
        ];
    }

    /**
     * 验证历史顶层字段只在输入阶段转换为个人偏好对象.
     */
    #[DataProvider('legacyMetadataProvider')]
    public function testLegacyLongTermMemoryFieldIsConverted(array $data, bool $expected): void
    {
        $metadata = MessageMetadata::fromArray($data);

        $this->assertSame(
            ['long_term_memory_enabled' => $expected],
            $metadata->getPersonalPreferences()
        );
        $this->assertArrayNotHasKey('long_term_memory_enabled', $metadata->toArray());
        $this->assertSame(
            ['long_term_memory_enabled' => $expected],
            $metadata->toArray()['personal_preferences']
        );
    }

    /**
     * 提供历史顶层字段兼容测试值.
     *
     * @return array<string, array{0: array<string, mixed>, 1: bool}>
     */
    public static function legacyMetadataProvider(): array
    {
        return [
            '历史显式开启' => [['long_term_memory_enabled' => true], true],
            '历史显式关闭' => [['long_term_memory_enabled' => false], false],
            '历史非法值默认开启' => [['long_term_memory_enabled' => 'false'], true],
        ];
    }
}
