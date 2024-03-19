<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Script;

class TestClass
{
    public function __construct()
    {
    }

    public function __toString()
    {
        return 'var_dump';
    }

    public function isRun(): bool
    {
        return true;
    }

    public function echo($str): void
    {
        if (is_string($str)) {
            echo $str;
        } else {
            echo 'only allowed type of string';
        }
    }

    public function invoke($obj)
    {
        $obj(8888);
    }
}
