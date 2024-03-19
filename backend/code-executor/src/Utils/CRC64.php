<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor\Utils;

/**
 * CRC64计算工具类.
 */
class CRC64
{
    /**
     * CRC64查找表.
     */
    private static array $crc64tab = [];

    /**
     * 当前CRC值
     */
    private int $value = 0;

    /**
     * 构造函数，初始化CRC64查找表.
     */
    public function __construct()
    {
        // 仅在第一次实例化时初始化查找表
        if (self::$crc64tab === []) {
            $this->initCrcTable();
        }
    }

    /**
     * 追加字符串内容到当前CRC计算中.
     */
    public function append(string $string): void
    {
        $len = \strlen($string);

        // 避免每次循环都计算字符串长度
        for ($i = 0; $i < $len; ++$i) {
            $this->value = ~$this->value;
            $this->value = $this->count(\ord($string[$i]), $this->value);
            $this->value = ~$this->value;
        }
    }

    /**
     * 获取或设置当前CRC值
     */
    public function value(?int $value = null): int
    {
        if ($value !== null) {
            $this->value = $value;
        }

        return $this->value;
    }

    /**
     * 获取CRC计算结果（字符串形式）.
     */
    public function result(): string
    {
        return sprintf('%u', $this->value);
    }

    /**
     * 快速计算内容的CRC64值
     */
    public static function calculate(string $content): string
    {
        $crc64 = new static();
        $crc64->append($content);
        return $crc64->result();
    }

    /**
     * 初始化CRC64查找表.
     */
    private function initCrcTable(): void
    {
        $poly64rev = (0xC96C5795 << 32) | 0xD7870F42;

        for ($n = 0; $n < 256; ++$n) {
            $crc = $n;
            for ($k = 0; $k < 8; ++$k) {
                if ($crc & 1) {
                    $crc = ($crc >> 1) & ~(0x8 << 60) ^ $poly64rev;
                } else {
                    $crc = ($crc >> 1) & ~(0x8 << 60);
                }
            }
            self::$crc64tab[$n] = $crc;
        }
    }

    /**
     * 计算单个字节的CRC值
     */
    private function count(int $byte, int $crc): int
    {
        return self::$crc64tab[($crc ^ $byte) & 0xFF] ^ (($crc >> 8) & ~(0xFF << 56));
    }
}
