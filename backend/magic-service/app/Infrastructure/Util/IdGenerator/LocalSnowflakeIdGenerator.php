<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\IdGenerator;

use Hyperf\Context\ApplicationContext;
use Hyperf\Snowflake\ConfigurationInterface;
use Hyperf\Snowflake\IdGenerator;
use Hyperf\Snowflake\MetaGenerator\RandomMilliSecondMetaGenerator;
use Hyperf\Snowflake\MetaGeneratorInterface;

class LocalSnowflakeIdGenerator extends IdGenerator
{
    public function __construct()
    {
        $container = ApplicationContext::getContainer();
        parent::__construct(
            new RandomMilliSecondMetaGenerator(
                $container->get(ConfigurationInterface::class),
                MetaGeneratorInterface::DEFAULT_BEGIN_SECOND
            )
        );
    }
}
