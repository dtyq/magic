<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
/*
 * Get the class "basename" of the given object / class.
 *
 * @param object|string $class
 * @return string
 */
if (! function_exists('class_basename')) {
    function class_basename($class): string
    {
        $class = is_object($class) ? get_class($class) : $class;

        return basename(str_replace('\\', '/', $class));
    }
}

if (! function_exists('random_str')) {
    function random_str(int $length = 16): string
    {
        $str = '';
        $str_pol = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz';
        $max = strlen($str_pol) - 1;
        for ($i = 0; $i < $length; ++$i) {
            $str .= $str_pol[mt_rand(0, $max)];
        }
        return $str;
    }
}
