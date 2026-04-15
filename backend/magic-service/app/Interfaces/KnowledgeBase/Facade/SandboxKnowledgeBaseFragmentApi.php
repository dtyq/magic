<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Facade;

use Dtyq\ApiResponse\Annotation\ApiResponse;

#[ApiResponse(version: 'low_code')]
class SandboxKnowledgeBaseFragmentApi extends AbstractKnowledgeBaseApi
{
    public function similarityByAgent(string $agentCode): array
    {
        $agentCode = trim($agentCode);
        $query = trim((string) $this->request->query('query', ''));

        return $this->knowledgeBaseFragmentAppService->agentSimilarityRaw(
            $this->getAuthorization(),
            $agentCode,
            $query,
        );
    }
}
