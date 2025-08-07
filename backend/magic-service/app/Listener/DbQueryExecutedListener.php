<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Listener;

use Hyperf\Collection\Arr;
use Hyperf\Database\Events\QueryExecuted;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;

#[Listener]
class DbQueryExecutedListener implements ListenerInterface
{
    private LoggerInterface $logger;

    // 敏感表
    private array $sensitiveTables = [
        'magic_chat_messages',
        'magic_chat_message_versions',
        'magic_flow_memory_histories',
    ];

    public function __construct(ContainerInterface $container)
    {
        $this->logger = $container->get(LoggerFactory::class)->get('sql');
    }

    public function listen(): array
    {
        return [
            QueryExecuted::class,
        ];
    }

    /**
     * @param QueryExecuted $event
     */
    public function process(object $event): void
    {
        if ($event instanceof QueryExecuted) {
            $sql = $event->sql;
            if (! Arr::isAssoc($event->bindings)) {
                $position = 0;
                foreach ($event->bindings as $value) {
                    $position = strpos($sql, '?', $position);
                    if ($position === false) {
                        break;
                    }
                    $value = "'{$value}'";
                    $sql = substr_replace($sql, $value, $position, 1);
                    $position += strlen($value);
                }
            }

            // 只打印前 1024 个字符
            $sql = substr($sql, 0, 1024);

            // 对敏感表的SQL进行脱敏处理
            $sql = $this->desensitizeSql($sql);
            $this->logger->info(sprintf('[%s:%s] %s', $event->connectionName, $event->time, $sql));
        }
    }

    /**
     * 对敏感表的SQL进行脱敏处理
     * 1. 对INSERT语句，保留id字段值，其他字段值替换为'***'
     * 2. 对UPDATE语句，将修改的字段值替换为'***'.
     */
    private function desensitizeSql(string $sql): string
    {
        // 检查是否操作敏感表
        $isSensitive = false;
        foreach ($this->sensitiveTables as $table) {
            // 使用更严格的表名匹配
            $pattern = '/\b' . preg_quote($table, '/') . '\b/i';
            if (preg_match($pattern, $sql)) {
                $isSensitive = true;
                break;
            }
        }

        // 如果不是敏感表，直接返回
        if (! $isSensitive) {
            return $sql;
        }

        // 使用大小写不敏感的正则表达式匹配SQL语句类型
        // 处理INSERT语句
        if (preg_match('/\binsert\s+into\b/i', $sql)) {
            // 提取并保留id字段，替换其他字段值为'***'
            $pattern = '/values\s*(\((?:[^)(]+|(?1))*\))/i';
            if (preg_match($pattern, $sql, $matches) && ! empty($matches[1])) {
                $values = $matches[1];
                // 处理单个或多个值列表的情况
                if (preg_match('/^\(([^,]+)(,.+)?\)$/i', $values, $valueMatches)) {
                    // 假设第一个字段是id
                    $idValue = trim($valueMatches[1]);
                    $replacement = '(' . $idValue . ', ***)';
                    $sql = preg_replace($pattern, 'VALUES ' . $replacement, $sql, 1);
                } else {
                    // 如果无法解析字段，则整体替换
                    $sql = preg_replace($pattern, '(***)', $sql, 1);
                }
            } else {
                // 如果无法匹配到VALUES子句，尝试另一种格式
                $pattern = '/\bvalues\b\s*(\((?:[^)(]+|(?1))*\))/i';
                if (preg_match($pattern, $sql, $matches) && ! empty($matches[1])) {
                    $sql = preg_replace($pattern, 'VALUES (***)', $sql, 1);
                }
            }
        }

        // 处理UPDATE语句
        if (preg_match('/\bupdate\b/i', $sql) && preg_match('/\bset\b/i', $sql)) {
            // 针对包含JSON数据的情况，采用更简单的方式脱敏
            if (preg_match('/json|[{}\[\]":]/', $sql)) {
                // 分割SQL获取表名部分和WHERE部分
                if (preg_match('/\bupdate\b\s+(`?\w+`?(?:\.\w+)?)\s+\bset\b/i', $sql, $tableMatches) && ! empty($tableMatches[1])) {
                    $tableName = $tableMatches[1];
                    $whereClause = '';
                    if (preg_match('/\bwhere\b(.*?)$/is', $sql, $whereMatches)) {
                        $whereClause = ' WHERE' . $whereMatches[1];
                    }
                    // 对于JSON数据，直接返回简化的SQL，保留表名和WHERE条件
                    return "UPDATE {$tableName} SET [复杂JSON数据已脱敏]{$whereClause}";
                }
                // 如果无法解析，完全脱敏
                return 'UPDATE [表名] SET [复杂数据已脱敏]';
            }

            // 提取SET和WHERE之间的部分，更健壮的处理方式
            $pattern = '/\bset\b(.*?)(?:\bwhere\b|$)/is';
            if (preg_match($pattern, $sql, $setMatches)) {
                $setClause = $setMatches[1];
                $originalSetClause = $setClause;

                // 更健壮地分割和处理SET子句中的赋值部分
                $fieldPattern = '/(`?\w+`?(?:\.\w+)?)\s*=\s*(?:\'(?:[^\'\\\]|\\\.)*\'|"(?:[^"\\\]|\\\.)*"|[^,\s]+)(?:,|$)/is';
                if (preg_match_all($fieldPattern, $setClause, $fieldMatches)) {
                    foreach ($fieldMatches[0] as $index => $match) {
                        $fieldName = $fieldMatches[1][$index];
                        $replacement = $fieldName . " = '***'";
                        // 保持原有的逗号分隔符
                        if (str_ends_with(trim($match), ',')) {
                            $replacement .= ',';
                        }
                        $setClause = str_replace($match, $replacement, $setClause);
                    }
                    $sql = str_replace($originalSetClause, $setClause, $sql);
                } else {
                    // 如果无法通过正则解析，采用更简单的方式脱敏
                    if (preg_match('/\bupdate\b\s+(`?\w+`?(?:\.\w+)?)/i', $sql, $tableMatches) && ! empty($tableMatches[1])) {
                        $tableName = $tableMatches[1];
                        $whereClause = '';
                        if (preg_match('/\bwhere\b(.*?)$/is', $sql, $whereMatches)) {
                            $whereClause = ' WHERE' . $whereMatches[1];
                        }
                        $sql = "UPDATE {$tableName} SET [数据已脱敏]{$whereClause}";
                    }
                }
            }
        }

        // 处理SELECT语句，脱敏可能包含的敏感数据
        if (preg_match('/\bselect\b/i', $sql)) {
            foreach ($this->sensitiveTables as $table) {
                if (preg_match('/\b' . preg_quote($table, '/') . '\b/i', $sql)) {
                    // 简单地在日志中标记为敏感查询，不显示详细内容
                    return "SELECT [敏感数据] FROM {$table} [查询已脱敏]";
                }
            }
        }

        return $sql;
    }
}
