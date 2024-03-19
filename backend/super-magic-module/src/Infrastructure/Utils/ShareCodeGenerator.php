<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use InvalidArgumentException;

/**
 * 分享代码生成器工具类.
 */
class ShareCodeGenerator
{
    /**
     * 分享代码长度.
     */
    protected int $codeLength = 18;

    /**
     * 允许的字符集.
     */
    protected string $charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    /**
     * 最后生成的时间戳微秒值.
     */
    protected int $lastMicrotime = 0;

    /**
     * 同一微秒内的序列号.
     */
    protected int $sequence = 0;

    /**
     * 生成一个唯一的分享代码
     *
     * 基于时间戳和序列号生成唯一代码，保证在分布式环境中的唯一性
     * 最终生成类似 "AB12XY89" 格式的友好分享代码
     *
     * @param string $prefix 可选前缀，用于业务区分，默认为空
     * @return string 生成的分享代码
     */
    public function generate(string $prefix = ''): string
    {
        // 获取当前微秒时间戳
        $currentMicro = $this->getCurrentMicroseconds();

        // 处理同一微秒内的多次调用
        if ($currentMicro === $this->lastMicrotime) {
            ++$this->sequence;
        } else {
            $this->sequence = 0;
            $this->lastMicrotime = $currentMicro;
        }

        // 组合唯一数据源
        $uniqueData = $currentMicro . $this->sequence;

        // 添加一个随机种子增加随机性
        $randomSeed = random_int(1000, 9999);
        $uniqueData .= $randomSeed;

        // 计算哈希值
        $hash = md5($uniqueData);

        // 将哈希转换为分享代码友好格式
        $code = $this->hashToReadableCode($hash);

        // 确保代码长度符合要求
        $code = substr($code, 0, $this->codeLength);

        // 如果有前缀，则添加前缀
        if (! empty($prefix)) {
            $code = $prefix . $code;
            // 确保总长度仍然符合要求
            $code = substr($code, 0, $this->codeLength);
        }

        return $code;
    }

    /**
     * 生成多个唯一的分享代码
     *
     * @param int $count 需要生成的代码数量
     * @param string $prefix 可选前缀，用于业务区分，默认为空
     * @return array 生成的分享代码数组
     */
    public function generateMultiple(int $count, string $prefix = ''): array
    {
        $codes = [];

        for ($i = 0; $i < $count; ++$i) {
            $codes[] = $this->generate($prefix);

            // 确保时间间隔，增加唯一性
            if ($i < $count - 1) {
                usleep(1); // 休眠1微秒
            }
        }

        return $codes;
    }

    /**
     * 设置分享代码长度.
     *
     * @param int $length 代码长度
     */
    public function setCodeLength(int $length): self
    {
        if ($length < 4) {
            throw new InvalidArgumentException('分享代码长度不能小于4');
        }

        $this->codeLength = $length;
        return $this;
    }

    /**
     * 设置字符集.
     *
     * @param string $charset 字符集
     */
    public function setCharset(string $charset): self
    {
        if (empty($charset)) {
            throw new InvalidArgumentException('字符集不能为空');
        }

        $this->charset = $charset;
        return $this;
    }

    /**
     * 验证分享代码是否有效.
     *
     * @param string $code 待验证的分享代码
     * @return bool 是否有效
     */
    public function isValid(string $code): bool
    {
        if (empty($code) || strlen($code) !== $this->codeLength) {
            return false;
        }

        // 检查代码是否只包含字符集中的字符
        for ($i = 0; $i < strlen($code); ++$i) {
            if (strpos($this->charset, $code[$i]) === false) {
                return false;
            }
        }

        return true;
    }

    /**
     * 将哈希值转换为易读的分享代码
     *
     * @param string $hash 哈希值
     * @return string 友好格式的分享代码
     */
    protected function hashToReadableCode(string $hash): string
    {
        $result = '';
        $charsetLength = strlen($this->charset);

        // 将哈希值分组处理，每组4位
        for ($i = 0; $i < strlen($hash); $i += 2) {
            // 从哈希中取出2个字符，转换为16进制数值
            $hexVal = hexdec(substr($hash, $i, 2));

            // 映射到字符集范围
            $index = $hexVal % $charsetLength;
            $result .= $this->charset[$index];

            // 达到目标长度则停止
            if (strlen($result) >= $this->codeLength) {
                break;
            }
        }

        return $result;
    }

    /**
     * 获取当前微秒时间戳.
     *
     * @return int 微秒时间戳
     */
    protected function getCurrentMicroseconds(): int
    {
        // 获取微秒级时间戳
        $microtime = microtime(true);

        // 转换为整数，乘以1000000以获得微秒级精度
        return (int) ($microtime * 1000000);
    }
}
