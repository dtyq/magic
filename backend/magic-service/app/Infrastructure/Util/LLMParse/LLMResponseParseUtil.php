<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\LLMParse;

use Hyperf\Codec\Json;

class LLMResponseParseUtil
{
    public static function parseJson(string $content): ?array
    {
        $parseResult = self::parseLLMResponse($content, 'json');
        $jsonArray = $parseResult ? Json::decode($parseResult) : null;
        return is_array($jsonArray) ? $jsonArray : null;
    }

    public static function parseMarkdown(string $content): string
    {
        return self::parseLLMResponse($content, 'markdown');
    }

    private static function parseLLMResponse(string $content, string $type): ?string
    {
        $content = trim($content);
        $typePattern = sprintf('/```%s\s*([\s\S]*?)\s*```/i', $type);
        // 匹配 ```json 或 ``` 之间的 JSON 数据
        if (preg_match($typePattern, $content, $matches)) {
            $matchString = $matches[1];
        } elseif (preg_match('/```\s*([\s\S]*?)\s*```/i', $content, $matches)) { // 匹配 ``` 之间的内容
            $matchString = $matches[1];
        } else {
            $matchString = ''; // 没有找到 JSON 数据
        }
        $matchString = ! empty($matchString) ? trim($matchString) : trim($content);
        if ($type === 'json') {
            if (json_validate($matchString)) {
                return $matchString;
            }
            return null; // JSON 格式不正确
        }
        return $matchString;
    }
}
