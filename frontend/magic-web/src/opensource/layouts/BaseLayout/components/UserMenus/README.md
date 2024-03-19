# UserMenus Component

User menu dropdown component with organization information, points, and action menus.

## Component Structure

```
UserMenus/
├── components/               # Sub-components
│   ├── OrganizationInfoCard.tsx  # Organization info with avatar and badge
│   ├── PointsInfo.tsx            # Points display and action buttons
│   ├── UserMenuContent.tsx       # Menu content wrapper
│   └── index.ts                  # Barrel export
├── hooks/                    # Custom hooks
│   ├── useLanguageOptions.tsx    # Language options for menu
│   ├── useMenuActions.ts         # Menu click handlers
│   └── useUserMenu.tsx           # Menu items generation
├── constants.tsx            # Menu key constants
├── index.tsx               # Main component
└── README.md              # This file
```

## Main Component

**UserMenus** (`index.tsx`)
- Main dropdown wrapper component
- Manages dropdown open/close state
- Fetches organization points when opened
- Delegates rendering to sub-components

## Sub-components

### OrganizationInfoCard
Displays organization information with avatar, name, badge, and points.

**Features:**
- Organization switcher dropdown
- Personal/Team organization display
- Avatar with fallback handling
- Subscription badge
- Points information

**Props:**
- `onClose: () => void` - Callback when card actions close the menu

### PointsInfo
Displays organization points with action buttons.

**Features:**
- Points balance display
- Upgrade/Renew button (for admins in commercial version)
- Recharge button (for admins in commercial version)
- Points detail button

**Props:**
- `onClose: () => void` - Callback when actions close the menu

### UserMenuContent
Wrapper component for the entire menu content.

**Props:**
- `menu: MenuProps["items"]` - Menu items configuration
- `onMenuClick: (info: { key: string }) => void` - Menu item click handler
- `onClose: () => void` - Callback to close the menu

## Custom Hooks

### useUserMenu
Generates menu items based on user permissions and app configuration.

**Parameters:**
- `isPreviewMode?: boolean` - Whether in preview mode (shows minimal menu)

**Returns:**
- `menu: MenuProps["items"]` - Menu items configuration

### useMenuActions
Handles menu item click actions.

**Parameters:**
- `onClose: () => void` - Callback to close menu after action

**Returns:**
- `handleMenuClick: ({ key: string }) => void` - Menu click handler

### useLanguageOptions
Generates language options for the language switcher submenu.

**Returns:**
- `languageOptions: MenuProps["items"]` - Language menu items

## Usage

```tsx
import UserMenus from "@/opensource/layouts/BaseLayout/components/Sider/components/UserMenus"

function Sidebar() {
  return (
    <UserMenus placement="rightTop">
      <Avatar /> {/* Trigger element */}
    </UserMenus>
  )
}
```

## Styling

All components use Tailwind CSS utility classes. No separate style files are needed.

## Key Features

- **Organization Switching**: Switch between personal and team organizations
- **Points Management**: View and manage organization points
- **Settings Access**: Quick access to account settings and preferences
- **Admin Access**: Admin portal link for organization admins
- **Language Switcher**: Change interface language
- **Share Management**: Manage shared content
- **Feedback**: Submit online feedback (commercial version only)
- **Logout**: Sign out from the application

## Dependencies

- React 18+
- Ant Design 5.x
- MobX (for state management)
- Tailwind CSS
- lucide-react (icons)
- @tabler/icons-react (icons)
