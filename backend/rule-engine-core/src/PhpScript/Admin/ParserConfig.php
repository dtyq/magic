<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript\Admin;

class ParserConfig
{
    // 是否允许用户声明类
    public bool $allowDeclareClasses = false;

    public function isAllowDeclareClasses(): bool
    {
        return $this->allowDeclareClasses;
    }

    public function setAllowDeclareClasses(bool $allowDeclareClasses): ParserConfig
    {
        $this->allowDeclareClasses = $allowDeclareClasses;
        return $this;
    }
}
