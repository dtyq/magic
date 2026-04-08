<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject;

use function Hyperf\Translation\trans;

enum BuiltinSkill: string
{
    case AnalyzingDataDashboard = 'analyzing-data-dashboard';
    case AnalyzingDataHtmlReport = 'analyzing-data-html-report';
    case ConnectingImBot = 'connecting-im-bot';
    case CreatingSlides = 'creating-slides';
    case CrewCreator = 'crew-creator';
    case DataQa = 'data-qa';
    case DeepResearch = 'deep-research';
    case DesigningCanvasImages = 'designing-canvas-images';
    case EnvManager = 'env-manager';
    case FindSkill = 'find-skill';
    case SkillCreator = 'skill-creator';
    case StandardizingStQuotation = 'standardizing-st-quotation';
    case UsingCron = 'using-cron';
    case UsingLlm = 'using-llm';
    case UsingMcp = 'using-mcp';

    public function getSkillName(): string
    {
        return trans("builtin_skills.names.{$this->value}");
    }

    public function getNameI18n(): array
    {
        $name = $this->getSkillName();

        return [
            'zh_CN' => $name,
            'en_US' => $name,
        ];
    }

    public function getSkillDescription(): string
    {
        return trans("builtin_skills.descriptions.{$this->value}");
    }

    public function getDescriptionI18n(): array
    {
        $description = $this->getSkillDescription();

        return [
            'zh_CN' => $description,
            'en_US' => $description,
        ];
    }

    public function getSkillIcon(): string
    {
        return '';
    }

    public function getPackageName(): string
    {
        return $this->value;
    }

    public function getSourceI18n(): array
    {
        return [
            'zh_CN' => '官方内置',
            'en_US' => 'Official Built-in',
        ];
    }

    /**
     * @return array<BuiltinSkill>
     */
    public static function getAllBuiltinSkills(): array
    {
        return self::cases();
    }

    /**
     * @return array<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
