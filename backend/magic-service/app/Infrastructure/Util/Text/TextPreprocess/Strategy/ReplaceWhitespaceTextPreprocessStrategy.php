<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Text\TextPreprocess\Strategy;

class ReplaceWhitespaceTextPreprocessStrategy extends AbstractTextPreprocessStrategy
{
    public function preprocess(string $content): string
    {
        // 替换连续的空白字符(换行符、制表符、空格)
        return preg_replace('/[\s\n\t]+/', '', $content);
    }
}
