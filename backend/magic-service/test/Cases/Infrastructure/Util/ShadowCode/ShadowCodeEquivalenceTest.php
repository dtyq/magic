<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Util\ShadowCode;

use App\Infrastructure\Util\ShadowCode\ShadowCode;
use PHPUnit\Framework\TestCase;

/**
 * 验证 V2 发送与旧字节映射的等价性及历史载荷兼容。
 * @internal
 */
final class ShadowCodeEquivalenceTest extends TestCase
{
    /**
     * 新发送格式保留原字节映射，以 Base64 安全承载有效 UTF-8 文本。
     */
    public function testShadowPreservesOriginalByteMapping(): void
    {
        foreach (['', 'a', '{"metadata":{"topic_id":"1"}}', "저 中文 \u{1f600}"] as $sample) {
            $legacyBytes = substr($this->legacyShadow($sample), strlen(ShadowCode::PREFIX));
            self::assertSame(ShadowCode::PREFIX_V2 . base64_encode($legacyBytes), ShadowCode::shadow($sample));
            self::assertSame($sample, ShadowCode::unShadow(ShadowCode::shadow($sample)));
        }
    }

    /**
     * 历史接收行为继续兼容任意旧字节载荷。
     */
    public function testUnShadowMatchesOriginalByteLoop(): void
    {
        foreach ($this->samples() as $sample) {
            $shadowed = ShadowCode::PREFIX . $sample;
            self::assertSame($this->legacyUnShadow($shadowed), ShadowCode::unShadow($shadowed));
        }
    }

    /**
     * 旧格式仍能还原全部字节，新格式支持空正文。
     */
    public function testRoundTripAndAllBytes(): void
    {
        $allBytes = implode('', array_map('chr', range(0, 255)));
        self::assertSame($allBytes, ShadowCode::unShadow($this->legacyShadow($allBytes)));
        self::assertSame('', ShadowCode::unShadow(ShadowCode::shadow('')));
    }

    /**
     * 无标记正文不做解码。
     */
    public function testInputWithoutPrefixIsReturnedUntouched(): void
    {
        self::assertSame('{"a":1}', ShadowCode::unShadow('{"a":1}'));
    }

    /**
     * 生成隔离的合成字节样例。
     */
    private function samples(): array
    {
        mt_srand(42);
        $samples = ['', 'a', '{"metadata":{"topic_id":"1"}}', '中文 <?php echo 1; ?>'];
        for ($i = 0; $i < 20; ++$i) {
            $samples[] = random_bytes(mt_rand(1, 4096));
        }
        return $samples;
    }

    /**
     * 复现历史发送字节循环，作为独立参照。
     */
    private function legacyShadow(string $input): string
    {
        for ($i = 0; $i < strlen($input); ++$i) {
            $input[$i] = chr(ShadowCode::shuffleMap[ord($input[$i])]);
        }
        return ShadowCode::PREFIX . $input;
    }

    /**
     * 复现历史接收字节循环，作为独立参照。
     */
    private function legacyUnShadow(string $input): string
    {
        $input = substr($input, strlen(ShadowCode::PREFIX));
        for ($i = 0; $i < strlen($input); ++$i) {
            $input[$i] = chr(ShadowCode::unShuffleMap[ord($input[$i])]);
        }
        return $input;
    }
}
