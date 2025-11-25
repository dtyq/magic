<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'names' => [
        // File Operations
        'list_dir' => 'List Directory',
        'read_files' => 'Read Multiple Files',
        'write_file' => 'Write File',
        'edit_file' => 'Edit File',
        'multi_edit_file' => 'Multi Edit File',
        'delete_file' => 'Delete File',
        'file_search' => 'File Search',
        'grep_search' => 'Content Search',

        // Search & Extraction
        'web_search' => 'Web Search',
        'image_search' => 'Image Search',
        'read_webpages_as_markdown' => 'Webpage to Markdown',
        'use_browser' => 'Browser Operation',
        'download_from_urls' => 'Batch Download',
        'download_from_markdown' => 'Download from Markdown',

        // Content Processing
        'visual_understanding' => 'Visual Understanding',
        'convert_to_markdown' => 'Convert to Markdown',
        'voice_understanding' => 'Voice Recognition',
        'summarize' => 'Summarize',
        'generate_image' => 'Generate Image',
        'create_slide' => 'Create Slide',
        'create_slide_project' => 'Create Slide Project',
        'create_dashboard_project' => 'Create Dashboard',
        'update_dashboard_template' => 'Update Dashboard Template',
        'backup_dashboard_template' => 'Backup Dashboard Template',
        'finish_dashboard_task' => 'Finish Dashboard Task',

        // System Execution
        'shell_exec' => 'Execute Command',
        'run_python_snippet' => 'Run Python Snippet',

        // AI Assistance
        'create_memory' => 'Create Memory',
        'update_memory' => 'Update Memory',
        'delete_memory' => 'Delete Memory',
        'finish_task' => 'Finish Task',
        'compact_chat_history' => 'Compact Chat History',
    ],

    'descriptions' => [
        // File Operations
        'list_dir' => 'Directory content viewing tool, supports recursive display of multi-level directory structure, shows file size, line count and token count, helps quickly understand project file organization and code scale',
        'read_files' => 'Batch file reading tool, reads multiple file contents at once, supports text, PDF, Word, Excel, CSV and other formats, greatly improves multi-file task processing efficiency',
        'write_file' => 'File writing tool, writes content to local file system, supports creating new files or overwriting existing files, note single content length limit, large files are recommended to be written in steps',
        'edit_file' => 'File precise editing tool, performs string replacement operations on existing files, supports strict matching validation and replacement count control, ensures editing operation accuracy',
        'multi_edit_file' => 'Multiple file editing tool, performs multiple find-replace operations in a single file, all edits are applied in order, either all succeed or all fail, ensuring operation atomicity',
        'delete_file' => 'File deletion tool, used to delete specified files or directories, can only delete files in the working directory, please confirm the file path is correct before operation',
        'file_search' => 'File path search tool, fast search based on fuzzy matching of file paths, suitable for scenarios where part of the file path is known but the specific location is uncertain, returns up to 10 results',
        'grep_search' => 'File content search tool, uses regular expressions to search for specific patterns in file content, supports file type filtering, displays matching lines and context, returns up to 20 related files',

        // Search & Extraction
        'web_search' => 'Internet search tool, supports XML format configuration for parallel processing of multiple search requests, supports paginated search and time range filtering, search results include title, URL, summary and source website',
        'image_search' => 'Image search tool, searches and intelligently filters high-quality images based on keywords, supports visual understanding analysis and aspect ratio filtering, automatic deduplication ensures image quality',
        'read_webpages_as_markdown' => 'Batch webpage reading tool, aggregates multiple webpage contents and converts them into a single Markdown document, supports full content retrieval and summary mode',
        'use_browser' => 'Browser automation tool, provides atomic browser operation capabilities, supports page navigation, element interaction, form filling and other modular operations',
        'download_from_urls' => 'URL batch download tool, supports XML configuration for multiple download tasks, automatically handles redirects, automatically overwrites if target file already exists',
        'download_from_markdown' => 'Markdown file batch download tool, extracts image links from Markdown files and downloads them in batches, supports network URLs and local file copying',

        // Content Processing
        'visual_understanding' => 'Visual understanding tool, analyzes and interprets image content, supports JPEG, PNG, GIF and other formats, suitable for image recognition description, chart analysis, text extraction, multi-image comparison and other scenarios',
        'convert_to_markdown' => 'Document format conversion tool, converts documents to Markdown format and saves to specified location. Supports multiple file types: PDF, Word, Excel, PowerPoint, images, Jupyter notebooks, etc',
        'voice_understanding' => 'Speech recognition tool, converts audio files to text, supports wav, mp3, ogg, m4a and other formats, can enable speaker information recognition function',
        'summarize' => 'Information refining tool, improves text information density, removes redundant content to make it more structured, supports custom refining requirements and target length settings',
        'generate_image' => 'Image generation and editing tool that creates new images from text descriptions and modifies existing images. Allows customizing image dimensions, quantity, and saving location to meet various creative needs',
        'create_slide' => 'Slide creation tool, generates HTML slides and executes custom JavaScript analysis, supports layout checking and element boundary validation',
        'create_slide_project' => 'Slide project creation tool, automatically creates complete project structure, includes presentation controller, configuration files, resource folders and communication scripts',
        'create_dashboard_project' => 'Data dashboard project creation tool, copies complete data dashboard framework from template directory, includes HTML, CSS, JavaScript and chart components',
        'update_dashboard_template' => 'Dashboard template update tool, syncs dashboard.js, index.css, index.html and config.js files from template directory to existing project',
        'backup_dashboard_template' => 'Dashboard template backup recovery tool, restores backup version of template files for specified project, implements swapping of current files and backup files',
        'finish_dashboard_task' => 'Dashboard project completion tool, automates completion of map and data source configuration, includes GeoJSON download, HTML configuration update and data file scanning',

        // System Execution
        'shell_exec' => 'Shell command execution tool, executes system commands and scripts, supports timeout settings and working directory specification, suitable for file operations, process management and other system administration scenarios',
        'run_python_snippet' => 'Python code snippet execution tool, suitable for data analysis, processing, conversion, quick calculations, validation and file operations. Suitable for small to medium Python code snippets (<=200 lines), complex scripts should be persisted to files and then executed using shell_exec tool',

        // AI Assistance
        'create_memory' => 'Long-term memory creation tool, stores user preferences, project information and other important memories, supports user and project memory types, can set whether user confirmation is required',
        'update_memory' => 'Long-term memory update tool, modifies existing memory content or tag information, locates and updates specified memory through memory ID',
        'delete_memory' => 'Long-term memory deletion tool, completely removes unnecessary memory information through memory ID, used to clean up outdated or incorrect memory data',
        'finish_task' => 'Task completion tool, called when all required tasks are completed, provides final reply or pauses task to give user feedback, enters stop state after calling',
        'compact_chat_history' => 'Chat history compression tool, used to compress and optimize chat history when conversations become too long, analyzes conversation process and generates summary to reduce context length and improve subsequent conversation efficiency',
    ],
];
