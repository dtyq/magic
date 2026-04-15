<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Port;

use App\Application\KnowledgeBase\DTO\FragmentRequestDTO;

interface FragmentGateway
{
    public function create(FragmentRequestDTO $request): array;

    public function runtimeCreate(FragmentRequestDTO $request): array;

    public function show(FragmentRequestDTO $request): array;

    public function list(FragmentRequestDTO $request): array;

    public function destroy(FragmentRequestDTO $request): bool;

    public function runtimeDestroyByBusinessId(FragmentRequestDTO $request): bool;

    public function runtimeDestroyByMetadataFilter(FragmentRequestDTO $request): bool;

    public function sync(FragmentRequestDTO $request): array;

    public function similarity(FragmentRequestDTO $request): array;

    public function runtimeSimilarity(FragmentRequestDTO $request): array;

    public function similarityByAgent(FragmentRequestDTO $request): array;

    public function preview(FragmentRequestDTO $request): array;
}
