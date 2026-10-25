<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\Service;

use App\Interfaces\SuperMagic\File\MagicFS\DTO\Response\FileTreeChangeDTO;

/**
 * 尚未推送、按 root 合并的文件树变更。
 *
 * 纯数据结构：不做 I/O、不读容器，所以合并与阈值行为可以脱离协程和数据库单独断言。
 *
 * 每个 root 一个桶，桶区间的语义与推送协议严格一致：
 *   from  排他下界 —— 本次追加之前的 head，也就是客户端此刻应当持有的游标；
 *   to    含上界 —— 本次追加分配到的最后一个 revision。
 * 只有桶里的行恰好铺满 (from, to] 且行数不超过 inline 阈值时，才允许内联 changes；
 * 否则只发区间，客户端回拉 journal 补齐。
 */
final class MagicFSChangeFeedPendingChanges
{
    /**
     * @var array<int, array{from:int,to:int,count:int,contiguous:bool,rows:array<int,array<string,mixed>>}>
     */
    private array $buckets = [];

    public function __construct(private readonly int $inlineMaxChanges)
    {
    }

    /**
     * @param array<int, array<string, mixed>> $rows journal 行，按 revision 分配顺序
     */
    public function append(int $rootFileId, int $fromRevision, int $toRevision, array $rows): void
    {
        if ($rootFileId <= 0 || $toRevision <= $fromRevision || $rows === []) {
            return;
        }

        if (! isset($this->buckets[$rootFileId])) {
            $this->buckets[$rootFileId] = [
                'from' => $fromRevision,
                'to' => $toRevision,
                'count' => 0,
                'contiguous' => true,
                'rows' => [],
            ];
        }

        $bucket = &$this->buckets[$rootFileId];
        // 同一个 head 锁下分配的区间天然相邻；一旦不相邻就出现空洞，
        // 内联行再也无法保证 (from, to] 连续，只能退化成区间通知。
        if ($bucket['count'] > 0 && $fromRevision !== $bucket['to']) {
            $bucket['contiguous'] = false;
        }
        $bucket['from'] = min($bucket['from'], $fromRevision);
        $bucket['to'] = max($bucket['to'], $toRevision);
        $bucket['count'] += count($rows);

        if ($bucket['contiguous'] && $bucket['count'] <= $this->inlineMaxChanges) {
            // 保持引用而不是拷贝：批量导入的 rows 本来就已经在内存里。
            $bucket['rows'] = $bucket['rows'] === [] ? $rows : array_merge($bucket['rows'], $rows);
        } else {
            // 超过阈值就把行丢掉：再大的批量导入最终也只会发一个区间，
            // 没必要为了发不出去的 payload 把上万行钉在内存里。
            $bucket['rows'] = [];
        }
        unset($bucket);
    }

    /**
     * 取走全部待推送 payload（每个 root 一个），并清空自身。
     *
     * payload 一定是可直接 json_encode 的普通数组，形状与推送协议一致。
     *
     * @return array<int, array<string, mixed>>
     */
    public function drain(): array
    {
        $buckets = $this->buckets;
        $this->buckets = [];

        $payloads = [];
        foreach ($buckets as $rootFileId => $bucket) {
            $payloads[] = $this->buildPayload((int) $rootFileId, $bucket);
        }

        return $payloads;
    }

    /**
     * @param array{from:int,to:int,count:int,contiguous:bool,rows:array<int,array<string,mixed>>} $bucket
     * @return array<string, mixed>
     */
    private function buildPayload(int $rootFileId, array $bucket): array
    {
        $changes = $this->inlineChanges($bucket);

        return [
            'root_file_id' => (string) $rootFileId,
            'from_revision' => $bucket['from'],
            'to_revision' => $bucket['to'],
            'changes' => $changes ?? [],
            'truncated' => $changes === null,
        ];
    }

    /**
     * 内联行；返回 null 表示这个桶只能发区间。
     *
     * 出参形状复用 FileTreeChangeDTO，与 HTTP 拉取接口共用同一套字段，
     * 客户端不需要认识第二种 change 形状。
     *
     * @param array{from:int,to:int,count:int,contiguous:bool,rows:array<int,array<string,mixed>>} $bucket
     * @return null|array<int, array<string, mixed>>
     */
    private function inlineChanges(array $bucket): ?array
    {
        if (! $bucket['contiguous'] || $bucket['rows'] === [] || $bucket['count'] > $this->inlineMaxChanges) {
            return null;
        }

        $rows = $bucket['rows'];
        usort($rows, static fn (array $left, array $right): int => ((int) $left['revision']) <=> ((int) $right['revision']));

        // Go 客户端只在 from_revision 等于自己的游标、且行首尾刚好接上时才会内联 apply；
        // 声称连续就必须真的连续，否则宁可让它回拉。
        $first = (int) ($rows[0]['revision'] ?? 0);
        $last = (int) ($rows[array_key_last($rows)]['revision'] ?? 0);
        if ($first !== $bucket['from'] + 1 || $last !== $bucket['to']) {
            return null;
        }

        return array_map(static fn (array $row): array => FileTreeChangeDTO::fromRow($row)->toArray(), $rows);
    }
}
