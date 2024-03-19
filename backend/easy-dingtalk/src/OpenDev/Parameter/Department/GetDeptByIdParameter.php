<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Parameter\Department;

use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidParameterException;
use Dtyq\EasyDingTalk\OpenDev\Parameter\AbstractParameter;

class GetDeptByIdParameter extends AbstractParameter
{
    private int $deptId;

    public function getDeptId(): int
    {
        return $this->deptId;
    }

    public function setDeptId(int $deptId): void
    {
        $this->deptId = $deptId;
    }

    protected function validateParams(): void
    {
        if (empty($this->deptId)) {
            throw new InvalidParameterException('dept_id 不能为空');
        }
    }
}
