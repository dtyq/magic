<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Contract;

/**
 * 文件树变更的推送出口（domain 端口）。
 *
 * journal 的唯一追加点需要把刚分配的 revision 区间广播出去，但持久化层不该知道
 * Socket.IO、room 或 payload 形状。实现放在 application 层，由容器注入。
 */
interface FileTreeChangePublisherInterface
{
    /**
     * 登记一段刚写进 journal 的变更区间。
     *
     * @param int $rootFileId 逻辑文件树根
     * @param int $fromRevision 排他下界：本次追加之前的 head，等于客户端此刻应持有的游标
     * @param int $toRevision 含上界：本次追加分配到的最后一个 revision
     * @param array<int, array<string, mixed>> $rows 本次写入的 journal 行，按 revision 升序
     */
    public function queue(int $rootFileId, int $fromRevision, int $toRevision, array $rows): void;
}
