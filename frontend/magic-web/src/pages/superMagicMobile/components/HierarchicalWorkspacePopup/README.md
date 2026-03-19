# HierarchicalWorkspacePopup Component

## Overview
A hierarchical workspace navigation popup component for mobile devices that supports workspace, project, and topic navigation with CRUD operations.

## Component Structure

### Main Component
- `index.tsx` (337 lines, reduced from 523 lines)
  - Orchestrates the popup logic and state management
  - Composes sub-components for rendering
  - Handles integration with hooks and services

### Sub-Components

#### WorkspaceListItem
- **Path**: `components/WorkspaceListItem/`
- **Purpose**: Renders individual workspace list items
- **Props**:
  - `workspace`: Workspace data
  - `isSelected`: Selection state
  - `onSelect`: Selection handler
  - `onActionClick`: Action menu handler
  - `onNavigate`: Navigation handler
  - `emptyText`: Placeholder text for unnamed workspaces

#### ProjectListItem
- **Path**: `components/ProjectListItem/`
- **Purpose**: Renders individual project list items with collaboration features
- **Props**:
  - `project`: Project data
  - `workspace`: Current workspace
  - `userInfo`: Current user information
  - `isSelected`: Selection state
  - `onSelect`: Selection handler
  - `onActionClick`: Action menu handler
  - `emptyText`: Placeholder text for unnamed projects

#### BottomActionBar
- **Path**: `components/BottomActionBar/`
- **Purpose**: Renders bottom action buttons (Add, Navigate)
- **Props**:
  - `level`: Current navigation level (workspace/project/topic)
  - `primaryText`: Primary button text
  - `secondaryText`: Secondary button text
  - `onPrimaryClick`: Primary button handler
  - `onSecondaryClick`: Secondary button handler

#### ActionModals
- **Path**: `components/ActionModals/`
- **Purpose**: Manages rename and delete confirmation modals
- **Props**:
  - `renameModalVisible`: Rename modal visibility state
  - `deleteModalVisible`: Delete modal visibility state
  - `currentActionItem`: Current item being acted upon
  - `onRenameCancel`: Rename cancel handler
  - `onRenameOk`: Rename confirm handler
  - `onDeleteCancel`: Delete cancel handler
  - `onDeleteOk`: Delete confirm handler
  - `onRenameInputChange`: Input change handler
  - `translations`: Localized strings

## Hooks

### useHierarchicalWorkspacePopup
Main hook that manages:
- Navigation state (workspace → project → topic)
- CRUD operations
- Modal states
- Action button configurations
- Data fetching and filtering

### useModalStates
Manages modal visibility states for:
- Actions popup
- Rename modal
- Delete modal
- Share modal

### useNavigationState
Handles hierarchical navigation between:
- Workspace level
- Project level
- Topic level

## Key Features

1. **Hierarchical Navigation**: Three-level navigation system (workspace → project → topic)
2. **Collaboration Support**: Special handling for collaboration workspaces and projects
3. **CRUD Operations**: Full create, read, update, delete support for all entities
4. **Responsive Design**: Mobile-optimized with Tailwind CSS
5. **Animation**: Smooth slide transitions between navigation levels
6. **Internationalization**: Full i18n support through react-i18next

## Benefits of Refactoring

### Before (523 lines)
- Single large component with all logic
- Difficult to maintain and test
- Code duplication in list rendering
- Poor separation of concerns

### After (337 lines main + 4 sub-components)
- Modular, reusable sub-components
- Each component has single responsibility
- Easier to test and maintain
- Better type safety
- Reduced cognitive load

### Component Size Breakdown
- Main component: 337 lines (36% reduction)
- WorkspaceListItem: ~50 lines
- ProjectListItem: ~80 lines
- BottomActionBar: ~40 lines
- ActionModals: ~90 lines

## Usage Example

```tsx
import HierarchicalWorkspacePopup from './HierarchicalWorkspacePopup'

function MyComponent() {
  const popupRef = useRef<HierarchicalWorkspacePopupRef>(null)

  const handleOpen = () => {
    popupRef.current?.open()
  }

  return (
    <>
      <button onClick={handleOpen}>Open Workspace Popup</button>
      <HierarchicalWorkspacePopup ref={popupRef} />
    </>
  )
}
```

## Testing Strategy

Each sub-component can be tested independently:

1. **WorkspaceListItem**: Test selection, action clicks, navigation
2. **ProjectListItem**: Test collaboration features, pinned state, selection
3. **BottomActionBar**: Test button clicks and text rendering
4. **ActionModals**: Test modal visibility, input changes, confirmations

## Future Improvements

1. Consider extracting translation logic into a custom hook
2. Add loading states for async operations
3. Implement virtualization for large lists
4. Add keyboard navigation support
5. Enhance accessibility with ARIA labels
