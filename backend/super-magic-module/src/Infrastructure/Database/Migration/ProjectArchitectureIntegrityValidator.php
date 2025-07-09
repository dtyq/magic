<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Database\Migration;

use Exception;
use Hyperf\DbConnection\Db;
use Psr\Log\LoggerInterface;

/**
 * Project architecture data integrity validator.
 */
class ProjectArchitectureIntegrityValidator
{
    private LoggerInterface $logger;

    private array $validationResults = [];

    public function __construct(LoggerInterface $logger)
    {
        $this->logger = $logger;
    }

    /**
     * Validate data integrity after project architecture migration.
     */
    public function validateMigration(): array
    {
        $this->logger->info('Starting project architecture data integrity validation');

        $this->validateProjectTableExists();
        $this->validateTopicProjectAssociations();
        $this->validateProjectWorkspaceConsistency();
        $this->validateDefaultProjectCreation();
        $this->validateFileTableRename();
        $this->validateProjectStatusValues();

        $this->logger->info('Completed project architecture data integrity validation', [
            'total_checks' => count($this->validationResults),
            'passed' => array_sum(array_column($this->validationResults, 'passed')),
            'failed' => count($this->validationResults) - array_sum(array_column($this->validationResults, 'passed')),
        ]);

        return $this->validationResults;
    }

    /**
     * Get validation summary.
     */
    public function getValidationSummary(): array
    {
        $total = count($this->validationResults);
        $passed = array_sum(array_column($this->validationResults, 'passed'));
        $failed = $total - $passed;

        return [
            'total_checks' => $total,
            'passed' => $passed,
            'failed' => $failed,
            'success_rate' => $total > 0 ? round(($passed / $total) * 100, 2) : 0,
            'all_passed' => $failed === 0,
        ];
    }

    /**
     * Get failed validation checks.
     */
    public function getFailedChecks(): array
    {
        return array_filter($this->validationResults, function ($result) {
            return ! $result['passed'];
        });
    }

    /**
     * Check if project table exists and has correct structure.
     */
    private function validateProjectTableExists(): void
    {
        try {
            $tableExists = Db::select("SHOW TABLES LIKE 'magic_super_agent_project'");
            if (empty($tableExists)) {
                $this->addValidationResult('project_table_exists', false, 'Project table does not exist');
                return;
            }

            // Check table structure
            $columns = Db::select('DESCRIBE magic_super_agent_project');
            $requiredColumns = [
                'id', 'user_id', 'user_organization_code', 'workspace_id',
                'project_name', 'project_description', 'work_dir', 'project_status',
                'current_topic_id', 'current_topic_status', 'created_uid',
                'updated_uid', 'created_at', 'updated_at', 'deleted_at',
            ];

            $existingColumns = array_column($columns, 'Field');
            $missingColumns = array_diff($requiredColumns, $existingColumns);

            if (empty($missingColumns)) {
                $this->addValidationResult('project_table_structure', true, 'Project table has correct structure');
            } else {
                $this->addValidationResult(
                    'project_table_structure',
                    false,
                    'Project table missing columns: ' . implode(', ', $missingColumns)
                );
            }
        } catch (Exception $e) {
            $this->addValidationResult('project_table_exists', false, 'Error checking project table: ' . $e->getMessage());
        }
    }

    /**
     * Validate topic-project associations.
     */
    private function validateTopicProjectAssociations(): void
    {
        try {
            // Check if all topics have project_id
            $topicsWithoutProject = Db::select(
                'SELECT COUNT(*) as count FROM magic_super_agent_topics WHERE project_id = 0 OR project_id IS NULL'
            );

            $orphanedTopics = $topicsWithoutProject[0]->count ?? 0;

            if ($orphanedTopics == 0) {
                $this->addValidationResult('topic_project_associations', true, 'All topics have valid project associations');
            } else {
                $this->addValidationResult(
                    'topic_project_associations',
                    false,
                    "Found {$orphanedTopics} topics without project associations"
                );
            }

            // Validate that all project_ids in topics exist in projects table
            $invalidProjectRefs = Db::select('
                SELECT COUNT(*) as count 
                FROM magic_super_agent_topics t 
                LEFT JOIN magic_super_agent_project p ON t.project_id = p.id 
                WHERE t.project_id > 0 AND p.id IS NULL
            ');

            $invalidRefs = $invalidProjectRefs[0]->count ?? 0;

            if ($invalidRefs == 0) {
                $this->addValidationResult('topic_project_refs', true, 'All topic project references are valid');
            } else {
                $this->addValidationResult(
                    'topic_project_refs',
                    false,
                    "Found {$invalidRefs} topics with invalid project references"
                );
            }
        } catch (Exception $e) {
            $this->addValidationResult('topic_project_associations', false, 'Error validating topic-project associations: ' . $e->getMessage());
        }
    }

    /**
     * Validate project-workspace consistency.
     */
    private function validateProjectWorkspaceConsistency(): void
    {
        try {
            // Check if all projects have valid workspace_id
            $invalidWorkspaceRefs = Db::select('
                SELECT COUNT(*) as count 
                FROM magic_super_agent_project p 
                LEFT JOIN magic_super_agent_workspaces w ON p.workspace_id = w.id 
                WHERE w.id IS NULL
            ');

            $invalidRefs = $invalidWorkspaceRefs[0]->count ?? 0;

            if ($invalidRefs == 0) {
                $this->addValidationResult('project_workspace_consistency', true, 'All projects have valid workspace references');
            } else {
                $this->addValidationResult(
                    'project_workspace_consistency',
                    false,
                    "Found {$invalidRefs} projects with invalid workspace references"
                );
            }

            // Check if project users match workspace users
            $userMismatches = Db::select('
                SELECT COUNT(*) as count 
                FROM magic_super_agent_project p 
                JOIN magic_super_agent_workspaces w ON p.workspace_id = w.id 
                WHERE p.user_id != w.user_id
            ');

            $mismatches = $userMismatches[0]->count ?? 0;

            if ($mismatches == 0) {
                $this->addValidationResult('project_workspace_user_consistency', true, 'Project and workspace users are consistent');
            } else {
                $this->addValidationResult(
                    'project_workspace_user_consistency',
                    false,
                    "Found {$mismatches} projects with user mismatches"
                );
            }
        } catch (Exception $e) {
            $this->addValidationResult('project_workspace_consistency', false, 'Error validating project-workspace consistency: ' . $e->getMessage());
        }
    }

    /**
     * Validate that each workspace has at least one default project.
     */
    private function validateDefaultProjectCreation(): void
    {
        try {
            $workspacesWithoutProjects = Db::select('
                SELECT COUNT(*) as count 
                FROM magic_super_agent_workspaces w 
                LEFT JOIN magic_super_agent_project p ON w.id = p.workspace_id 
                WHERE p.id IS NULL AND w.deleted_at IS NULL
            ');

            $missingProjects = $workspacesWithoutProjects[0]->count ?? 0;

            if ($missingProjects == 0) {
                $this->addValidationResult('default_project_creation', true, 'All workspaces have at least one project');
            } else {
                $this->addValidationResult(
                    'default_project_creation',
                    false,
                    "Found {$missingProjects} workspaces without projects"
                );
            }
        } catch (Exception $e) {
            $this->addValidationResult('default_project_creation', false, 'Error validating default project creation: ' . $e->getMessage());
        }
    }

    /**
     * Validate file table rename.
     */
    private function validateFileTableRename(): void
    {
        try {
            // Check if old table doesn't exist
            $oldTableExists = Db::select("SHOW TABLES LIKE 'magic_super_agent_task_files'");
            $newTableExists = Db::select("SHOW TABLES LIKE 'magic_super_agent_project_files'");

            if (empty($oldTableExists) && ! empty($newTableExists)) {
                $this->addValidationResult('file_table_rename', true, 'File table successfully renamed from task_files to project_files');

                // Check if new table has project_id column
                $columns = Db::select('DESCRIBE magic_super_agent_project_files');
                $columnNames = array_column($columns, 'Field');

                if (in_array('project_id', $columnNames)) {
                    $this->addValidationResult('project_files_structure', true, 'Project files table has project_id column');
                } else {
                    $this->addValidationResult('project_files_structure', false, 'Project files table missing project_id column');
                }
            } else {
                $this->addValidationResult('file_table_rename', false, 'File table rename incomplete or failed');
            }
        } catch (Exception $e) {
            $this->addValidationResult('file_table_rename', false, 'Error validating file table rename: ' . $e->getMessage());
        }
    }

    /**
     * Validate project status values.
     */
    private function validateProjectStatusValues(): void
    {
        try {
            $invalidStatuses = Db::select("
                SELECT COUNT(*) as count 
                FROM magic_super_agent_project 
                WHERE project_status NOT IN ('active', 'archived', 'deleted')
            ");

            $invalidCount = $invalidStatuses[0]->count ?? 0;

            if ($invalidCount == 0) {
                $this->addValidationResult('project_status_values', true, 'All project status values are valid');
            } else {
                $this->addValidationResult(
                    'project_status_values',
                    false,
                    "Found {$invalidCount} projects with invalid status values"
                );
            }
        } catch (Exception $e) {
            $this->addValidationResult('project_status_values', false, 'Error validating project status values: ' . $e->getMessage());
        }
    }

    /**
     * Add validation result.
     */
    private function addValidationResult(string $check, bool $passed, string $message): void
    {
        $this->validationResults[] = [
            'check' => $check,
            'passed' => $passed,
            'message' => $message,
            'timestamp' => date('Y-m-d H:i:s'),
        ];

        $level = $passed ? 'info' : 'error';
        $this->logger->{$level}("Validation check: {$check}", ['passed' => $passed, 'message' => $message]);
    }
}
