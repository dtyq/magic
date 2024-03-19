<?php

namespace Tiptap\Core;

class Node extends Extension
{
    public static $priority = 100;

    public static $topNode = false;

    public static $marks = '_';

    public function addAttributes()
    {
        return [];
    }

    public function parseHTML()
    {
        return [];
    }

    public function renderHTML($node)
    {
        return null;
    }

    public static function wrapper($DOMNode)
    {
        return null;
    }
}
