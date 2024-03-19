<?php

namespace Tiptap\Core;

class Extension
{
    public static $name;

    public static $priority = 100;

    public $options = [];

    public function __construct(array $options = [])
    {
        $this->options = array_merge($this->addOptions(), $options);
    }

    public function addOptions()
    {
        return [];
    }

    public function addGlobalAttributes()
    {
        return [];
    }

    public function addExtensions()
    {
        return [];
    }
}
