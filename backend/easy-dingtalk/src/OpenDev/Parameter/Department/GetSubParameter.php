<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Parameter\Department;

use Dtyq\EasyDingTalk\OpenDev\Parameter\AbstractParameter;

class GetSubParameter extends AbstractParameter
{
    private int $deptId = 1;

    private string $language = 'zh_CN';

    public function setDeptId(int $deptId): void
    {
        $this->deptId = $deptId;
    }

    public function setLanguage(string $language): void
    {
        $this->language = $language;
    }

    public function getDeptId(): int
    {
        return $this->deptId;
    }

    public function getLanguage(): string
    {
        return $this->language;
    }

    protected function validateParams(): void
    {
    }
}
