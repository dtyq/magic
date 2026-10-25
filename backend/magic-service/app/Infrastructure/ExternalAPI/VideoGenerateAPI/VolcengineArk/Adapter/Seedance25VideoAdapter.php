<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Adapter;

use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Capability\Seedance25GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArkVideoClient;

/**
 * Seedance 2.5。
 *
 * 只负责钉死本家族的能力声明，payload 与 provider 交互沿用抽象基类。
 */
readonly class Seedance25VideoAdapter extends AbstractSeedanceVideoAdapter
{
    public function __construct(
        Seedance25GenerationCapabilityProvider $capabilityProvider,
        VolcengineArkVideoClient $client,
    ) {
        parent::__construct($capabilityProvider, $client);
    }
}
