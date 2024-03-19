<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Mock\ExecutableCode;

class TestClass
{
    public function add($arg1, $arg2)
    {
        return $arg1 + $arg2;
    }

    public function echo($str): void
    {
        if (is_string($str)) {
            echo $str;
        } else {
            echo 'only allowed type of string';
        }
    }
}
