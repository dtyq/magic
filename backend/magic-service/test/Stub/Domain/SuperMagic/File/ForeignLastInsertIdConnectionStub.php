<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Stub\Domain\SuperMagic\File;

/**
 * 复现线上连接池的 lastInsertId 残留：Hyperf 的 MySQL 连接在多个请求间复用，
 * PDO::lastInsertId() 一直是这条连接上「最近一次自增插入」的值，可能来自任何表。
 *
 * magic_super_agent_task_files 的 INSERT 一定显式带 file_id（雪花），MySQL 不会为该语句
 * 生成自增值，于是按自增模型插入的 Eloquent 会把这条残留值写回主键属性。单测里需要这个
 * 场景可复现，而不是只断言模型配置。
 *
 * @internal
 */
class ForeignLastInsertIdConnectionStub extends ArrayRowConnectionStub
{
    private int $foreignLastInsertId = 0;

    /**
     * 这条连接上残留的自增值，模拟「别的表最近生成的 ID」。
     */
    public function queueForeignLastInsertId(int $id): self
    {
        $this->foreignLastInsertId = $id;

        return $this;
    }

    /**
     * Model::insertAndSetId() 只用到 lastInsertId()，这里给出最小替身。
     */
    public function getPdo()
    {
        $id = $this->foreignLastInsertId;

        return new class($id) {
            public function __construct(private int $id)
            {
            }

            public function lastInsertId(?string $name = null): string
            {
                return (string) $this->id;
            }
        };
    }
}
