<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Message;

use App\Domain\SuperMagic\Common\Entity\ValueObject\UserInfoValueObject;
use App\Domain\SuperMagic\Message\Entity\ValueObject\MessageMetadata;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use TypeError;

/**
 * 验证沙箱 INIT 和 CHAT 共用的用户信息序列化契约。
 * @internal
 */
final class UserInfoThirdPlatformIdTest extends TestCase
{
    /**
     * 旧输入、null 和显式清空均保持兼容，字符串不发生数字转换。
     */
    #[DataProvider('profileCases')]
    public function testMetadataPreservesSourceId(array $input, string $expected): void
    {
        $profile = UserInfoValueObject::fromArray(['id' => 'mock-user'] + $input);
        self::assertSame($expected, $profile->getThirdPlatformId());
        foreach ([null, ['long_term_memory_enabled' => true]] as $preferences) {
            $metadata = new MessageMetadata(userInfo: $profile, personalPreferences: $preferences);
            self::assertSame($expected, $metadata->toArray()['user']['third_platform_id']);
        }
        self::assertSame($profile->toArray(), UserInfoValueObject::fromArray($profile->toArray())->toArray());
        self::assertSame('', (new UserInfoValueObject('mock-user'))->getThirdPlatformId());
    }

    /**
     * 提供纯合成的新旧字段样例。
     */
    public static function profileCases(): array
    {
        return [[[], ''], [['third_platform_id' => null], ''], [['third_platform_id' => ''], ''], [['third_platform_id' => '00123'], '00123'], [['third_platform_id' => '0'], '0']];
    }

    /**
     * 非法结构不能变成伪造的身份字符串。
     */
    public function testStructuredIdentityIsRejected(): void
    {
        $this->expectException(TypeError::class);
        UserInfoValueObject::fromArray(['third_platform_id' => ['mock-invalid']]);
    }
}
