<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Result\Department;

use Dtyq\EasyDingTalk\OpenDev\Result\AbstractResult;

class AllParentDepartmentResult extends AbstractResult
{
    private array $parentDeptIdList;

    public function buildByRawData(array $rawData): void
    {
        $this->parentDeptIdList = $rawData['parent_dept_id_list'] ?? [];
    }

    public function getParentDeptIdList(): array
    {
        return $this->parentDeptIdList;
    }

    public function currentDeptId(): ?int
    {
        $deptId = $this->parentDeptIdList[0] ?? null;
        if (! is_null($deptId)) {
            $deptId = (int) $deptId;
        }
        return $deptId;
    }
}
