<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Adapter;

use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Capability\Seedance20GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArkVideoClient;

/**
 * Seedance 2.0 与 2.0 pro。
 *
 * 只负责钉死本家族的能力声明，payload 与 provider 交互沿用抽象基类。
 */
readonly class Seedance20VideoAdapter extends AbstractSeedanceVideoAdapter
{
    public function __construct(
        Seedance20GenerationCapabilityProvider $capabilityProvider,
        VolcengineArkVideoClient $client,
    ) {
        parent::__construct($capabilityProvider, $client);
    }
}
