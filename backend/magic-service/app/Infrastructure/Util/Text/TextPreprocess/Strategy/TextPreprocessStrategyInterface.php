<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Text\TextPreprocess\Strategy;

interface TextPreprocessStrategyInterface
{
    public function preprocess(string $content): string;
}
