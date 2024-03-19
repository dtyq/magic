# OnlyOffice Comp Documentation

> 📖 English | [中文](readme.zh.md)

OnlyOffice Comp is a document editor component library based on OnlyOffice, supporting online editing, viewing, and conversion of Word, Excel, PowerPoint, and other documents.

## Table of Contents

- [Quick Start](#quick-start)
- [Core API](#core-api)
- [Event System](#event-system)
- [Complete Examples](#complete-examples)
- [API Reference](#api-reference)

## Quick Start

### 1. Initialize Editor

Before using the editor, you need to initialize the OnlyOffice environment:

```typescript
import { initializeOnlyOffice } from '@/onlyoffice-comp/lib/utils';

// Initialize OnlyOffice (only needs to be called once, automatically cached)
await initializeOnlyOffice();
```

### 2. Create Editor View

There are two ways to create an editor view: create a new document or open an existing document. Supports both single-instance and multi-instance modes.

```typescript
import { createEditorView } from '@/onlyoffice-comp/lib/x2t';

// Single-instance mode: Create new document (using default container)
await createEditorView({
  isNew: true,
  fileName: 'New_Document.docx',
});

// Single-instance mode: Open existing document
const file = new File([...], 'document.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
await createEditorView({
  isNew: false,
  fileName: 'document.docx',
  file: file,
});

// Multi-instance mode: Specify container ID
const manager1 = await createEditorView({
  isNew: true,
  fileName: 'Doc1.docx',
  containerId: 'editor-1', // Specify container ID
});

const manager2 = await createEditorView({
  isNew: true,
  fileName: 'Doc2.xlsx',
  containerId: 'editor-2', // Different container ID
});
```

### 3. Add Editor Container

Add editor container in React component:

**Single-Instance Mode:**
```tsx
import { ONLYOFFICE_ID } from '@/onlyoffice-comp/lib/const';

export default function EditorPage() {
  return (
    <div className="flex-1 relative">
      <div id={ONLYOFFICE_ID} className="absolute inset-0" />
    </div>
  );
}
```

**Multi-Instance Mode:**
```tsx
export default function MultiEditorPage() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* First editor container */}
      <div className="onlyoffice-container relative" data-onlyoffice-container-id="editor-1">
        <div id="editor-1" className="absolute inset-0" />
      </div>
      
      {/* Second editor container */}
      <div className="onlyoffice-container relative" data-onlyoffice-container-id="editor-2">
        <div id="editor-2" className="absolute inset-0" />
      </div>
      
      {/* Third editor container */}
      <div className="onlyoffice-container relative" data-onlyoffice-container-id="editor-3">
        <div id="editor-3" className="absolute inset-0" />
      </div>
    </div>
  );
}
```

**Note**: In multi-instance mode, you must use the `data-onlyoffice-container-id` attribute to precisely locate containers and avoid routing operations like image uploads to the wrong instance.

## Core API

### `initializeOnlyOffice()`

Initialize the OnlyOffice editor environment, including loading scripts, API, and X2T converter.

```typescript
import { initializeOnlyOffice } from '@/onlyoffice-comp/lib/utils';

await initializeOnlyOffice();
```

**Features:**
- Uses singleton pattern, multiple calls will only initialize once
- Automatically loads all required resources
- Returns Promise, supports async/await

### `createEditorView(options)`

Create editor view, supports creating new or opening documents. Supports both single-instance and multi-instance modes.

```typescript
import { createEditorView } from '@/onlyoffice-comp/lib/x2t';

await createEditorView({
  isNew: boolean;           // Whether to create new document
  fileName: string;         // File name (with extension)
  file?: File;             // File object (required when opening existing document)
  readOnly?: boolean;       // Whether read-only mode, defaults to false
  lang?: string;           // Interface language, defaults to 'en'
  containerId?: string;    // Container ID (required for multi-instance mode, optional for single-instance mode)
  editorManager?: EditorManager; // Editor manager instance (optional)
});
```

**Return Value:** `Promise<EditorManager>` - Returns editor manager instance

**Single-Instance Mode:**
```typescript
// Don't specify containerId, use default container
await createEditorView({
  isNew: true,
  fileName: 'document.docx',
});
```

**Multi-Instance Mode:**
```typescript
// Specify containerId, create independent instance
const manager = await createEditorView({
  isNew: true,
  fileName: 'document.docx',
  containerId: 'editor-1', // Must specify unique container ID
});
```

**Supported File Types:**
- Word: `.docx`, `.doc`, `.odt`, `.rtf`, `.txt`
- Excel: `.xlsx`, `.xls`, `.ods`, `.csv`
- PowerPoint: `.pptx`, `.ppt`, `.odp`

### `editorManagerFactory` and `EditorManager`

Editor manager factory and editor manager, providing editor operation and control functions.

#### Single-Instance Mode (Backward Compatible)

```typescript
import { editorManagerFactory } from '@/onlyoffice-comp/lib/editor-manager';

// Get default instance
const editorManager = editorManagerFactory.getDefault();

// Check if editor exists
if (editorManager.exists()) {
  // Editor has been created
}

// Export document
const binData = await editorManager.export();
// binData: { fileName: string, fileType: string, binData: Uint8Array, media?: Record<string, string> }

// Set read-only mode
await editorManager.setReadOnly(true);  // Set to read-only
await editorManager.setReadOnly(false); // Set to editable

// Get current read-only state
const isReadOnly = editorManager.getReadOnly();

// Destroy editor instance
editorManager.destroy();
```

#### Multi-Instance Mode

```typescript
import { editorManagerFactory } from '@/onlyoffice-comp/lib/editor-manager';

// Create or get instance with specified container ID
const manager1 = editorManagerFactory.create('editor-1');
const manager2 = editorManagerFactory.create('editor-2');

// Get instance with specified container ID
const manager = editorManagerFactory.get('editor-1');

// Get all instances
const allManagers = editorManagerFactory.getAll();

// Destroy specified instance
editorManagerFactory.destroy('editor-1');

// Destroy all instances
editorManagerFactory.destroyAll();
```

#### `EditorManager` Instance Methods

Each `EditorManager` instance provides the following methods:

**`exists()`** - Check if editor exists
```typescript
if (manager.exists()) {
  // Editor has been created
}
```

**`export()`** - Export document
```typescript
const binData = await manager.export();
// binData: { fileName: string, fileType: string, binData: Uint8Array, instanceId: string, media?: Record<string, string> }
```

**Note**: In multi-instance mode, the `export()` method automatically filters events, only receiving save events belonging to the current instance (matched via `instanceId`), ensuring that export data from other instances is not received.

**`setReadOnly(readOnly)`** - Set read-only mode
```typescript
await manager.setReadOnly(true);  // Set to read-only
await manager.setReadOnly(false); // Set to editable
```

**`getReadOnly()`** - Get current read-only state
```typescript
const isReadOnly = manager.getReadOnly();
```

**`getInstanceId()`** - Get unique ID of the instance
```typescript
const instanceId = manager.getInstanceId();
```

**`getContainerId()`** - Get container ID
```typescript
const containerId = manager.getContainerId();
```

**`destroy()`** - Destroy editor instance
```typescript
manager.destroy();
```

### `convertBinToDocument()`

Convert binary data to document in specified format.

```typescript
import { convertBinToDocument } from '@/onlyoffice-comp/lib/x2t';
import { FILE_TYPE } from '@/onlyoffice-comp/lib/const';

const result = await convertBinToDocument(
  binData.binData,      // Uint8Array
  binData.fileName,     // string
  FILE_TYPE.DOCX        // 'DOCX' | 'XLSX' | 'PPTX'
);

// result: { fileName: string, data: Uint8Array }
```

**Supported File Types:**
- `FILE_TYPE.DOCX` - Word document
- `FILE_TYPE.XLSX` - Excel spreadsheet
- `FILE_TYPE.PPTX` - PowerPoint presentation

## Event System

OnlyOffice Comp uses EventBus mechanism for event communication.

### Event Types

```typescript
import { ONLYOFFICE_EVENT_KEYS } from '@/onlyoffice-comp/lib/const';

ONLYOFFICE_EVENT_KEYS.SAVE_DOCUMENT   // 'saveDocument' - Document save event
ONLYOFFICE_EVENT_KEYS.DOCUMENT_READY  // 'documentReady' - Document ready event
ONLYOFFICE_EVENT_KEYS.LOADING_CHANGE  // 'loadingChange' - Loading state change event
```

### Listening to Events

```typescript
import { onlyofficeEventbus } from '@/onlyoffice-comp/lib/eventbus';
import { ONLYOFFICE_EVENT_KEYS } from '@/onlyoffice-comp/lib/const';

// Listen for document ready event
onlyofficeEventbus.on(ONLYOFFICE_EVENT_KEYS.DOCUMENT_READY, (data) => {
  console.log('Document ready:', data.fileName);
  // data: { fileName: string, fileType: string }
});

// Listen for document save event
onlyofficeEventbus.on(ONLYOFFICE_EVENT_KEYS.SAVE_DOCUMENT, (data) => {
  console.log('Document saved:', data.fileName);
  // data: { fileName: string, fileType: string, binData: Uint8Array, instanceId: string, media?: Record<string, string> }
  
  // In multi-instance mode, you can determine which instance's save event it is via instanceId
  if (data.instanceId === manager.getInstanceId()) {
    // This is the current instance's save event
  }
});

// Listen for Loading state change event (for export and other operations)
onlyofficeEventbus.on(ONLYOFFICE_EVENT_KEYS.LOADING_CHANGE, (data) => {
  setLoading(data.loading);
  // data: { loading: boolean }
});
```

### Waiting for Events

Use the `waitFor` method to wait for event trigger, returns Promise:

```typescript
// Wait for document ready (30 second timeout)
const readyData = await onlyofficeEventbus.waitFor(ONLYOFFICE_EVENT_KEYS.DOCUMENT_READY, 30000);

// Wait for document save (3 second timeout)
const saveData = await onlyofficeEventbus.waitFor(ONLYOFFICE_EVENT_KEYS.SAVE_DOCUMENT, 3000);
```

### Loading State Management

The `LOADING_CHANGE` event is automatically triggered during operations like document export, used to display loading state:

```typescript
import { useEffect, useState } from 'react';
import { onlyofficeEventbus } from '@/onlyoffice-comp/lib/eventbus';
import { ONLYOFFICE_EVENT_KEYS } from '@/onlyoffice-comp/lib/const';

function EditorPage() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Listen for loading state changes
    const handleLoadingChange = (data: { loading: boolean }) => {
      setLoading(data.loading);
    };
    
    onlyofficeEventbus.on(ONLYOFFICE_EVENT_KEYS.LOADING_CHANGE, handleLoadingChange);

    return () => {
      // Clean up listener
      onlyofficeEventbus.off(ONLYOFFICE_EVENT_KEYS.LOADING_CHANGE, handleLoadingChange);
    };
  }, []);

  return (
    <div>
      {loading && <Loading />}
      {/* Editor content */}
    </div>
  );
}
```

**Note:** The `editorManager.export()` method automatically triggers the `LOADING_CHANGE` event, no need to manually manage loading state.

### Remove Listeners

```typescript
const handler = (data) => {
  console.log('Event triggered:', data);
};

onlyofficeEventbus.on(ONLYOFFICE_EVENT_KEYS.DOCUMENT_READY, handler);
// ...
onlyofficeEventbus.off(ONLYOFFICE_EVENT_KEYS.DOCUMENT_READY, handler);
```

## Complete Examples

### React Component Example

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { convertBinToDocument, createEditorView } from '@/onlyoffice-comp/lib/x2t';
import { initializeOnlyOffice } from '@/onlyoffice-comp/lib/utils';
import { setDocmentObj, getDocmentObj } from '@/onlyoffice-comp/lib/document-state';
import { editorManagerFactory } from '@/onlyoffice-comp/lib/editor-manager';
import { ONLYOFFICE_EVENT_KEYS, FILE_TYPE, ONLYOFFICE_ID } from '@/onlyoffice-comp/lib/const';
import { onlyofficeEventbus } from '@/onlyoffice-comp/lib/eventbus';

// Get default instance (backward compatible)
const editorManager = editorManagerFactory.getDefault();

export default function EditorPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  // Create or open document
  const handleView = async (fileName: string, file?: File) => {
    setLoading(true);
    setError(null);
    try {
      setDocmentObj({ fileName, file });
      await initializeOnlyOffice();
      const { fileName: currentFileName, file: currentFile } = getDocmentObj();
      await createEditorView({
        file: currentFile,
        fileName: currentFileName,
        isNew: !currentFile,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  // Export document
  const handleExport = async () => {
    try {
      const binData = await editorManager.export();
      const result = await convertBinToDocument(
        binData.binData,
        binData.fileName,
        FILE_TYPE.DOCX
      );
      
      // Download file
      const blob = new Blob([result.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = binData.fileName;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        await initializeOnlyOffice();
        await handleView('New_Document.docx');
      } catch (err) {
        setError('Unable to load editor component');
      }
    };

    init();

    // Listen for document ready event
    onlyofficeEventbus.on(ONLYOFFICE_EVENT_KEYS.DOCUMENT_READY, (data) => {
      console.log('Document ready:', data);
    });

    // Listen for loading state changes
    const handleLoadingChange = (data: { loading: boolean }) => {
      setLoading(data.loading);
    };
    onlyofficeEventbus.on(ONLYOFFICE_EVENT_KEYS.LOADING_CHANGE, handleLoadingChange);

    return () => {
      onlyofficeEventbus.off(ONLYOFFICE_EVENT_KEYS.LOADING_CHANGE, handleLoadingChange);
      editorManager.destroy();
      // Or destroy all instances: editorManagerFactory.destroyAll();
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Control bar */}
      <div className="bg-gradient-to-r from-white to-gray-50 border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center gap-4">
          <div className="flex gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-500 text-white rounded-md"
            >
              Upload Document
            </button>
            <button
              onClick={() => handleView('New_Document.docx')}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md"
            >
              New Document
            </button>
            {editorManager.exists() && (
              <>
                <button
                  onClick={handleExport}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md"
                >
                  💾 Export
                </button>
                <button
                  onClick={async () => {
                    const newReadOnly = !readOnly;
                    setReadOnly(newReadOnly);
                    await editorManager.setReadOnly(newReadOnly);
                  }}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md"
                >
                  {readOnly ? '🔒 Read-Only' : '✏️ Edit'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4">
          <p>{error}</p>
        </div>
      )}

      {/* Editor container */}
      <div className={
        `${ONLYOFFICE_CONTAINER_CONFIG.PARENT_ID} flex-1 relative`
      }>
        <div id={ONLYOFFICE_ID} className="absolute inset-0" />
      </div>

      {/* File input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.doc"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleView(file.name, file);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        }}
      />
    </div>
  );
}
```

## API Reference

### Constants

#### `ONLYOFFICE_ID`
Editor container DOM ID, defaults to `'iframe2'`

#### `ONLYOFFICE_EVENT_KEYS`
Event name constants:
- `ONLYOFFICE_EVENT_KEYS.SAVE_DOCUMENT` - Document save event
- `ONLYOFFICE_EVENT_KEYS.DOCUMENT_READY` - Document ready event
- `ONLYOFFICE_EVENT_KEYS.LOADING_CHANGE` - Loading state change event

#### `FILE_TYPE`
File type constants:
- `FILE_TYPE.DOCX` - Word document
- `FILE_TYPE.XLSX` - Excel spreadsheet
- `FILE_TYPE.PPTX` - PowerPoint presentation

### Type Definitions

#### `DocumentReadyData`
```typescript
type DocumentReadyData = {
  fileName: string;
  fileType: string;
};
```

#### `SaveDocumentData`
```typescript
type SaveDocumentData = {
  fileName: string;      // File name
  fileType: string;      // File type (e.g., 'xlsx', 'docx')
  binData: Uint8Array;   // Binary data
  instanceId: string;    // Instance ID (used for event matching in multi-instance mode)
  media?: Record<string, string>; // Media file mapping (optional)
};
```

#### `LoadingChangeData`
```typescript
type LoadingChangeData = {
  loading: boolean;
};
```

## Notes

1. **Initialization Order**: Must call `initializeOnlyOffice()` before creating editor
2. **Container Element**:
   - Single-instance mode: Ensure page contains container element with ID `ONLYOFFICE_ID`
   - Multi-instance mode: Ensure each instance uses unique container ID and uses `data-onlyoffice-container-id` attribute for precise positioning
3. **File Types**: Ensure file extension matches file content
4. **Event Cleanup**: Remember to remove event listeners and destroy editor when component unmounts
5. **Async Operations**: All APIs are asynchronous, need to use `await` or `.then()` to handle
6. **Multi-Instance Resource Isolation**: Each editor instance manages independent media resources, image uploads handled through independent `writeFile` handler functions
7. **Container ID Uniqueness**: In multi-instance mode, each editor instance must use a unique container ID

## Supported File Formats

### Word Documents
- `.docx` - Word 2007+
- `.doc` - Word 97-2003
- `.odt` - OpenDocument Text
- `.rtf` - Rich Text Format
- `.txt` - Plain text

### Excel Spreadsheets
- `.xlsx` - Excel 2007+
- `.xls` - Excel 97-2003
- `.ods` - OpenDocument Spreadsheet
- `.csv` - CSV file

### PowerPoint Presentations
- `.pptx` - PowerPoint 2007+
- `.ppt` - PowerPoint 97-2003
- `.odp` - OpenDocument Presentation
