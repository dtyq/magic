<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Text\TextPreprocess;

use App\Infrastructure\Util\Text\TextPreprocess\Strategy\ExcelHeaderConcatTextPreprocessStrategy;
use App\Infrastructure\Util\Text\TextPreprocess\Strategy\RemoveUrlEmailTextPreprocessStrategy;
use App\Infrastructure\Util\Text\TextPreprocess\Strategy\ReplaceWhitespaceTextPreprocessStrategy;
use App\Infrastructure\Util\Text\TextPreprocess\Strategy\TextPreprocessStrategyInterface;
use App\Infrastructure\Util\Text\TextPreprocess\ValueObject\TextPreprocessRule;

/**
 * 文本预处理工具.
 */
class TextPreprocessUtil
{
    /**
     * 根据文本预处理规则进行预处理.
     * @param array<TextPreprocessRule> $rules
     */
    public static function preprocess(array $rules, string $text): string
    {
        // 保护标签内容
        $protectedContent = [];
        $text = preg_replace_callback(
            '/<MagicCompressibleContent[^>]*>.*?<\/MagicCompressibleContent>/s',
            function ($matches) use (&$protectedContent) {
                $key = '{{PROTECTED_' . count($protectedContent) . '}}';
                $protectedContent[$key] = $matches[0];
                return $key;
            },
            $text
        );

        // 如果有EXCEL_HEADER_CONCAT 需要先执行，并且删除EXCEL_HEADER_CONCAT规则
        $excelHeaderConcatRule = array_filter($rules, fn (TextPreprocessRule $rule) => $rule === TextPreprocessRule::EXCEL_HEADER_CONCAT);
        if (count($excelHeaderConcatRule) > 0) {
            $text = di(ExcelHeaderConcatTextPreprocessStrategy::class)->preprocess($text);
            $rules = array_filter($rules, fn (TextPreprocessRule $rule) => $rule !== TextPreprocessRule::EXCEL_HEADER_CONCAT);
        }
        foreach ($rules as $rule) {
            /** @var ?TextPreprocessStrategyInterface $strategy */
            $strategy = match ($rule) {
                TextPreprocessRule::REPLACE_WHITESPACE => di(ReplaceWhitespaceTextPreprocessStrategy::class),
                TextPreprocessRule::REMOVE_URL_EMAIL => di(RemoveUrlEmailTextPreprocessStrategy::class),
                default => null,
            };
            if (! $strategy instanceof TextPreprocessStrategyInterface) {
                continue;
            }
            $text = $strategy->preprocess($text);
        }

        // 恢复标签内容
        foreach ($protectedContent as $key => $content) {
            $text = str_replace($key, $content, $text);
        }

        return $text;
    }
}
