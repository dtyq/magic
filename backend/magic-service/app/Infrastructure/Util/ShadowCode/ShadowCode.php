<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\ShadowCode;

use InvalidArgumentException;

/**
 * 跨端文本混淆协议，兼容旧字节载荷与 ASCII 安全的 V2 载荷。
 */
class ShadowCode
{
    public const string PREFIX = 'SHADOWED_';

    public const string PREFIX_V2 = 'SHADOWED2_';

    public const array shuffleMap = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 122, 34, 45, 86, 60, 103, 51, 114, 64, 52, 68, 91, 40, 90, 48, 126, 110, 63, 124, 77, 98, 50, 73, 66, 113, 97, 79, 37, 102, 76, 32, 87, 96, 54, 111, 44, 101, 116, 93, 57, 59, 84, 58, 108, 120, 94, 69, 41, 74, 62, 99, 105, 95, 53, 115, 49, 43, 47, 82, 100, 61, 71, 125, 72, 119, 56, 83, 81, 42, 109, 35, 46, 92, 89, 75, 112, 55, 67, 70, 85, 118, 117, 39, 104, 33, 65, 121, 38, 123, 88, 107, 78, 80, 106, 36, 127, 129, 128, 131, 130, 133, 132, 135, 134, 137, 136, 139, 138, 141, 140, 143, 142, 145, 144, 147, 146, 149, 148, 151, 150, 153, 152, 155, 154, 157, 156, 159, 158, 161, 160, 163, 162, 165, 164, 167, 166, 169, 168, 171, 170, 173, 172, 175, 174, 177, 176, 179, 178, 181, 180, 183, 182, 185, 184, 187, 186, 189, 188, 191, 190, 193, 192, 195, 194, 197, 196, 199, 198, 201, 200, 203, 202, 205, 204, 207, 206, 209, 208, 211, 210, 213, 212, 215, 214, 217, 216, 219, 218, 221, 220, 223, 222, 225, 224, 227, 226, 229, 228, 231, 230, 233, 232, 235, 234, 237, 236, 239, 238, 241, 240, 243, 242, 245, 244, 247, 246, 249, 248, 251, 250, 253, 252, 255, 254];

    public const array unShuffleMap = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 62, 116, 33, 102, 126, 59, 119, 114, 44, 79, 100, 88, 67, 34, 103, 89, 46, 87, 53, 38, 41, 85, 65, 108, 97, 71, 74, 72, 36, 92, 81, 49, 40, 117, 55, 109, 42, 78, 110, 93, 95, 54, 80, 106, 61, 51, 123, 58, 124, 99, 90, 98, 73, 111, 35, 63, 121, 105, 45, 43, 104, 70, 77, 84, 64, 57, 52, 82, 91, 68, 60, 37, 115, 83, 125, 122, 75, 101, 48, 66, 107, 56, 39, 86, 69, 113, 112, 96, 76, 118, 32, 120, 50, 94, 47, 127, 129, 128, 131, 130, 133, 132, 135, 134, 137, 136, 139, 138, 141, 140, 143, 142, 145, 144, 147, 146, 149, 148, 151, 150, 153, 152, 155, 154, 157, 156, 159, 158, 161, 160, 163, 162, 165, 164, 167, 166, 169, 168, 171, 170, 173, 172, 175, 174, 177, 176, 179, 178, 181, 180, 183, 182, 185, 184, 187, 186, 189, 188, 191, 190, 193, 192, 195, 194, 197, 196, 199, 198, 201, 200, 203, 202, 205, 204, 207, 206, 209, 208, 211, 210, 213, 212, 215, 214, 217, 216, 219, 218, 221, 220, 223, 222, 225, 224, 227, 226, 229, 228, 231, 230, 233, 232, 235, 234, 237, 236, 239, 238, 241, 240, 243, 242, 245, 244, 247, 246, 249, 248, 251, 250, 253, 252, 255, 254];

    /**
     * 默认写入 ASCII 安全的 V2，调用前需确保接收端已支持该版本。
     */
    public static function shadow(string $input): string
    {
        return self::shadowV2($input);
    }

    /**
     * 将混淆后的二进制字节以 Base64 承载，避免非法 UTF-8 被替换。
     */
    public static function shadowV2(string $input): string
    {
        if (preg_match('//u', $input) !== 1) {
            throw new InvalidArgumentException('Invalid shadow payload');
        }
        return self::PREFIX_V2 . base64_encode(strtr($input, self::getTable(self::shuffleMap)));
    }

    /**
     * 识别编码标记，包括需要明确拒绝的未知版本。
     */
    public static function isShadowed(string $input): bool
    {
        return preg_match('/^SHADOWED(?:[0-9]+)?_/', $input) === 1;
    }

    /**
     * 解码已标记的载荷；无前缀正文原样返回，损坏的 V2 不回退为明文。
     */
    public static function unShadow(string $input): string
    {
        if (str_starts_with($input, self::PREFIX_V2)) {
            $payload = substr($input, strlen(self::PREFIX_V2));
            $bytes = base64_decode($payload, true);
            if ($bytes === false || base64_encode($bytes) !== $payload) {
                throw new InvalidArgumentException('Invalid shadow payload');
            }
            $decoded = strtr($bytes, self::getTable(self::unShuffleMap));
            if (preg_match('//u', $decoded) !== 1) {
                throw new InvalidArgumentException('Invalid shadow payload');
            }
            return $decoded;
        }
        if (preg_match('/^SHADOWED[0-9]+_/', $input) === 1) {
            throw new InvalidArgumentException('Unsupported shadow version');
        }
        if (! str_starts_with($input, self::PREFIX)) {
            return $input;
        }
        return strtr(substr($input, strlen(self::PREFIX)), self::getTable(self::unShuffleMap));
    }

    /**
     * 把 256 项映射表转成 strtr 需要的 [from => to] 数组，只构造一次.
     *
     * @param array<int, int> $map
     * @return array<string, string>
     */
    private static function getTable(array $map): array
    {
        static $tables = [];
        $key = $map === self::shuffleMap ? 'shuffle' : 'unShuffle';
        if (! isset($tables[$key])) {
            $table = [];
            foreach ($map as $from => $to) {
                if ($from !== $to) {
                    $table[chr($from)] = chr($to);
                }
            }
            $tables[$key] = $table;
        }
        return $tables[$key];
    }
}
