<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Stub\Domain\SuperMagic\File;

use Closure;
use Hyperf\Database\Connection;
use Hyperf\Database\Query\Grammars\Grammar;
use Hyperf\Database\Query\Grammars\MySqlGrammar;
use Hyperf\Database\Query\Processors\Processor;

/**
 * 以脚本化结果代替真实查询的连接，行形状固定为关联数组。
 *
 * 这正是线上 App\Listener\FetchModeListener 把每个 statement 改成 PDO::FETCH_ASSOC
 * 之后数据库返回的形状；也是文件树 head/journal 代码唯一必须支持的形状。
 *
 * select 结果按调用顺序出队，队列耗尽后返回空结果集：测试里既能精确描述
 * 「先查不到 head、再查到」这类分支顺序，也不会因为代码多查一次进入死循环。
 *
 * @internal
 */
class ArrayRowConnectionStub extends Connection
{
    /** @var list<array<int, array<string, mixed>>> */
    private array $selectScript = [];

    /** @var list<array{string, array<int, mixed>}> */
    private array $executed = [];

    /** @var list<int> 写语句按顺序返回的影响行数，队列耗尽后返回 1 */
    private array $writeScript = [];

    public function __construct()
    {
        parent::__construct(null);
    }

    /**
     * @param array<int, array<string, mixed>> ...$results
     */
    public function queueSelectRows(array ...$results): self
    {
        foreach ($results as $rows) {
            $this->selectScript[] = array_values($rows);
        }

        return $this;
    }

    /**
     * 按顺序指定写语句（insert/update/delete/insert ignore）返回的影响行数。
     */
    public function queueAffectedRows(int ...$counts): self
    {
        foreach ($counts as $count) {
            $this->writeScript[] = $count;
        }

        return $this;
    }

    public function select(string $query, array $bindings = [], bool $useReadPdo = true): array
    {
        $this->record($query, $bindings);

        return array_shift($this->selectScript) ?? [];
    }

    public function selectOne(string $query, array $bindings = [], bool $useReadPdo = true)
    {
        return array_shift($this->select($query, $bindings, $useReadPdo));
    }

    public function insert(string $query, array $bindings = []): bool
    {
        $this->record($query, $bindings);

        return true;
    }

    public function update(string $query, array $bindings = []): int
    {
        $this->record($query, $bindings);

        return $this->nextAffectedRows();
    }

    public function delete(string $query, array $bindings = []): int
    {
        $this->record($query, $bindings);

        return $this->nextAffectedRows();
    }

    public function statement(string $query, array $bindings = []): bool
    {
        $this->record($query, $bindings);

        return true;
    }

    public function affectingStatement(string $query, array $bindings = []): int
    {
        $this->record($query, $bindings);

        return $this->nextAffectedRows();
    }

    public function transaction(Closure $callback, int $attempts = 1)
    {
        return $callback($this);
    }

    public function transactionLevel(): int
    {
        return 0;
    }

    /**
     * @return list<array{string, array<int, mixed>}>
     */
    public function executedStatements(): array
    {
        return $this->executed;
    }

    /**
     * 命中 $table 的 select 语句绑定，按执行顺序，用于断言扫描游标这类谓词。
     *
     * @return list<array<int, mixed>>
     */
    public function selectBindingsFor(string $table): array
    {
        $bindings = [];
        foreach ($this->executed as [$query, $statementBindings]) {
            if (str_contains($query, $table) && preg_match('/^\s*select/i', $query) === 1) {
                $bindings[] = $statementBindings;
            }
        }

        return $bindings;
    }

    /**
     * 最近一条命中 $table 的写语句，绑定还原成「列名 => 值」，多行 insert 返回多行。
     *
     * Hyperf 的 Builder::insert() 会对每行 ksort 后再拼接，绑定顺序不能靠下标猜，
     * 所以这里解析 SQL 里的列名来配对。
     *
     * @return list<array<string, mixed>>
     */
    public function lastWriteRowsFor(string $table): array
    {
        foreach (array_reverse($this->executed) as [$query, $bindings]) {
            if (! $this->isWriteOn($query, $table)) {
                continue;
            }

            $columns = $this->boundColumns($query);
            if ($columns === []) {
                continue;
            }

            // update 的绑定里还带着 where 的值，按列数取整只保留 SET/values 部分。
            $columnCount = count($columns);
            $rowCount = max(1, intdiv(count($bindings), $columnCount));

            return array_map(
                static fn (array $row): array => array_combine($columns, $row),
                array_chunk(array_slice($bindings, 0, $rowCount * $columnCount), $columnCount)
            );
        }

        return [];
    }

    protected function getDefaultQueryGrammar(): Grammar
    {
        // 生产连接走 MySQL 语法（反引号、for update），断言里的 SQL 与线上日志一致。
        return new MySqlGrammar();
    }

    protected function getDefaultPostProcessor(): Processor
    {
        return new Processor();
    }

    private function isWriteOn(string $query, string $table): bool
    {
        return str_contains($query, $table)
            && preg_match('/^(insert|update|delete)/i', ltrim($query)) === 1;
    }

    /**
     * 绑定里的 '?' 按顺序对应的列名。
     *
     * @return list<string>
     */
    private function boundColumns(string $query): array
    {
        if (preg_match('/insert(?: ignore)? into\s+`?[\w.]+`?\s*\(([^)]*)\)/i', $query, $matches) === 1) {
            return array_map(
                static fn (string $column): string => trim($column, " `\n\t"),
                explode(',', $matches[1])
            );
        }

        if (preg_match('/^update\s+`?[\w.]+`?\s+set\s+(.*?)(?:\s+where\s|$)/is', ltrim($query), $matches) === 1) {
            preg_match_all('/`([^`]+)`\s*=\s*\?/', $matches[1], $sets);

            return $sets[1] ?? [];
        }

        return [];
    }

    private function nextAffectedRows(): int
    {
        return array_shift($this->writeScript) ?? 1;
    }

    private function record(string $query, array $bindings): void
    {
        $this->executed[] = [$query, $bindings];
    }
}
