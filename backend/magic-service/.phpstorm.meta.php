<?php
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSTORM_META {
    // Reflect
    override(\Psr\Container\ContainerInterface::get(0), map(['' => '@']));
    override(\Hyperf\Context\Context::get(0), map(['' => '@']));
    override(\make(0), map(['' => '@']));
    override(\di(0), map(['' => '@']));
    override(\Hyperf\Support\make(0), map(['' => '@']));
    override(\Hyperf\Support\optional(0), type(0));
    override(\Hyperf\Tappable\tap(0), type(0));
}
