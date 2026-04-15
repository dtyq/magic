<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Port;

use App\Application\KnowledgeBase\DTO\KnowledgeBaseRequestDTO;

interface KnowledgeBaseGateway
{
    public function create(KnowledgeBaseRequestDTO $request): array;

    public function update(KnowledgeBaseRequestDTO $request): array;

    public function saveProcess(KnowledgeBaseRequestDTO $request): array;

    public function show(KnowledgeBaseRequestDTO $request): array;

    public function list(KnowledgeBaseRequestDTO $request): array;

    public function nodes(KnowledgeBaseRequestDTO $request): array;

    public function destroy(KnowledgeBaseRequestDTO $request): void;

    public function rebuild(KnowledgeBaseRequestDTO $request): array;

    public function repairSourceBindings(KnowledgeBaseRequestDTO $request): array;

    public function rebuildCleanup(KnowledgeBaseRequestDTO $request): array;
}
