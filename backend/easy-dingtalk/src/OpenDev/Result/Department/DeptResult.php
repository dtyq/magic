<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Result\Department;

use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidResultException;
use Dtyq\EasyDingTalk\OpenDev\Result\AbstractResult;

class DeptResult extends AbstractResult
{
    private int $deptId;

    /**
     * 通讯录加密的情况下，该值获取不到，默认空字符串.
     */
    private string $name;

    private int $parentId;

    public function buildByRawData(array $rawData): void
    {
        if (! isset($rawData['dept_id'])) {
            throw new InvalidResultException('dept_id 不能为空');
        }
        $this->deptId = (int) $rawData['dept_id'];
        $this->name = $rawData['name'] ?? '';
        $this->parentId = (int) ($rawData['parent_id'] ?? 0);
    }

    public function getDeptId(): int
    {
        return $this->deptId;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getParentId(): int
    {
        return $this->parentId;
    }
}
