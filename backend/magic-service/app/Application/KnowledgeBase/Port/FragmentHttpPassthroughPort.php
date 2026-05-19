<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Port;

use App\Application\KnowledgeBase\DTO\FragmentRequestDTO;
use App\Application\KnowledgeBase\DTO\RpcHttpPassthroughResult;

interface FragmentHttpPassthroughPort
{
    public function listPassthrough(FragmentRequestDTO $request): RpcHttpPassthroughResult;

    public function previewPassthrough(FragmentRequestDTO $request): RpcHttpPassthroughResult;

    public function similarityPassthrough(FragmentRequestDTO $request): RpcHttpPassthroughResult;
}
