# Vector Knowledge Base Module

This directory contains components, tools, and constant definitions related to the vector knowledge base. The module is mainly used for managing and utilizing vectorized document knowledge bases.

## Directory Structure

```
vectorKnowledge/
├── components/       # Components directory
│   ├── Configuration/ # Configuration components
│   ├── Create/       # Knowledge base creation components
│   ├── Details/      # Knowledge base details page components
│   ├── Embed/        # Document vector embedding components
│   ├── Setting/      # Knowledge base settings components
│   ├── SubSider/     # Side navigation components
│   ├── UpdateInfoModal/ # Update information modal components
│   └── Upload/       # Document upload components
├── constant/         # Constants definitions
│   └── index.tsx     # Contains file types, sync status, and other constants
├── layouts/          # Layout components
├── types/            # Type definitions
│   └── index.d.ts    # Type interfaces for the module
├── utils/            # Utility functions
```

## Main Features

### Knowledge Base Management
- Create knowledge base
- View knowledge base details
- Modify knowledge base settings
- Configure knowledge base parameters

### Document Management
- Upload documents (supports multiple file formats)
- View document list
- Delete documents (supports batch operations)
- Search documents
- Update document information

### Document Processing
- Document vectorization processing
- Document status tracking:
  - Pending: waiting to be processed
  - Success: successfully processed and available
  - Failed: processing failed
  - Processing: currently being processed
  - Deleted: successfully deleted
  - DeleteFailed: failed to delete
  - Rebuilding: being rebuilt

## Supported File Types
Supports various document formats, including:
- Text files (TXT)
- Markdown files (MD)
- PDF files (PDF)
- Spreadsheet files (XLS, XLSX, CSV)
- Document files (DOCX)
- XML files

## Technology Stack
- React
- TypeScript
- Ant Design component library
- Tabler Icons React for icon components
- RESTful API interaction 