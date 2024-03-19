<?php

namespace Tiptap\Core;

class Mark extends Extension
{
    public static $priority = 100;

    public function addAttributes()
    {
        return [];
    }

    public function renderHTML($mark)
    {
        return null;
    }

    public function parseHTML()
    {
        return [];
    }
}
