<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelAdmin\Constant;

enum NaturalLanguageProcessing
{
    public const string DEFAULT = 'default';

    public const string EMBEDDING = 'embedding'; // 嵌入

    public const string LLM = 'llm'; // 大语言
}
