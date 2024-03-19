<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util;

class PromptUtil
{
    public static function getPrompt(string $file, array $params = []): string
    {
        $prompt = file_get_contents(BASE_PATH . '/storage/prompt/' . $file) ?? '';

        return str_replace(array_keys($params), array_values($params), $prompt);
    }

    public static function getToolCallPrompt(array $params = []): string
    {
        return self::getPrompt('tool_call.md', $params);
    }
}
