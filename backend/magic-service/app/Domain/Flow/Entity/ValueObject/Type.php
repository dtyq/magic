<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject;

enum Type: int
{
    case None = 0;

    // 主流程（直接用作助理）
    case Main = 1;

    // 子流程
    case Sub = 2;

    // 工具
    case Tools = 3;

    // 组合节点，运行方式有点类似于子流程
    case CombinedNode = 4;

    // 循环节点
    case Loop = 5;

    public function needEndNode(): bool
    {
        return in_array($this, [self::Sub, self::Tools]);
    }

    public function canShowParams(): bool
    {
        return in_array($this, [self::Sub, self::Tools, self::CombinedNode]);
    }

    public function isMain(): bool
    {
        return $this === self::Main;
    }

    public function isSub(): bool
    {
        return $this === self::Sub;
    }

    public function isTools(): bool
    {
        return $this === self::Tools;
    }
}
