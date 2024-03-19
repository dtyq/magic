<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util;

use FuzzyWuzzy\Fuzz;
use FuzzyWuzzy\Process;

/**
 * 模型名称相似度匹配工具类.
 * 使用 wyndow/fuzzywuzzy 库进行模糊匹配.
 * 只接受名称数组，不读取文件，方便其他功能调用.
 */
class FuzzMatchUtil
{
    private static ?Fuzz $fuzz = null;

    private static ?Process $process = null;

    /**
     * 从名称数组中匹配最佳匹配的名称.
     *
     * @param string $inputName 输入的模型名称
     * @param int $minScore 最低相似度阈值（0-100），低于此值返回 null，默认 30
     * @param int $limit 返回结果数量限制，默认 10
     * @return array 返回匹配到的名称数组（key），按照分数从高到低排序
     */
    public static function findBestMatchName(string $inputName, array $nameKeys, int $minScore = 30, int $limit = 10): array
    {
        if (empty($inputName) || empty($nameKeys)) {
            return [];
        }

        self::initFuzzyWuzzy();

        $inputNameLower = mb_strtolower(trim($inputName));
        $candidates = []; // [name => score]

        // 1. 包含匹配
        foreach ($nameKeys as $modelName) {
            if (! is_string($modelName)) {
                $modelName = (string) $modelName;
            }
            $modelNameLower = mb_strtolower(trim($modelName));

            // 如果模型名称包含输入名称，或者输入名称包含模型名称
            if (str_contains($modelNameLower, $inputNameLower) || str_contains($inputNameLower, $modelNameLower)) {
                // 计算包含匹配的分数
                if ($modelNameLower === $inputNameLower) {
                    $score = 100;
                } else {
                    $containRatio = mb_strlen($inputNameLower) / max(mb_strlen($modelNameLower), 1);
                    $score = (int) min(90, 60 + ($containRatio * 30));
                }

                if ($score >= $minScore) {
                    $candidates[$modelName] = $score;
                }
            }
        }

        // 2. FuzzyWuzzy 模糊匹配
        // extract 方法参数: (query, choices, processor, scorer, limit)
        $result = self::$process->extract($inputName, $nameKeys, null, null, $limit);
        $resultArray = $result->toArray();

        foreach ($resultArray as $item) {
            if (is_array($item) && count($item) >= 2) {
                [$name, $score] = $item;
                if ($score >= $minScore) {
                    // 如果已经存在且分数更高，则不覆盖；否则更新分数
                    if (! isset($candidates[$name]) || $score > $candidates[$name]) {
                        $candidates[$name] = $score;
                    }
                }
            }
        }

        // 3. 排序 (按分数降序)
        arsort($candidates);

        // 4. 返回名称列表 (截取 limit)
        return array_slice(array_keys($candidates), 0, $limit);
    }

    /**
     * 初始化 FuzzyWuzzy 实例.
     */
    private static function initFuzzyWuzzy(): void
    {
        if (self::$fuzz === null) {
            self::$fuzz = new Fuzz();
            self::$process = new Process(self::$fuzz);
        }
    }
}
