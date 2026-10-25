<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Utils;

/**
 * 将接口结果转换为适合拼接到异常消息中的字符串.
 */
final class ResultFormatter
{
    /**
     * 格式化接口结果，优先使用 JSON，失败时回退为 PHP 结构表示.
     */
    public static function format(mixed $result): string
    {
        if (is_object($result) && method_exists($result, 'toArray')) {
            $result = $result->toArray();
        }

        $formatted = json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
        if ($formatted !== false) {
            return $formatted;
        }

        return var_export($result, true);
    }
}
