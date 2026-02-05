# AdNext Remodel Task: SaaS Hierarchy & Project Scoping

## Objective
Implement a tiered SaaS hierarchy: **User -> Project (Site/Client) -> Facebook Pages -> Data**.
Transition from a Workspace-centric (or flat) model to a Project-centric model where data is strictly scoped by Page and Project.

## 0. Plan & Architecture

### Hierarchy
- **Project**: Represents a "Client" or "Site". Belongs to a User.
- **Page (FacebookPage/MessengerPage)**: Belongs to a Project (and User).
- **Data (Leads, Logs, Automations)**: Belongs to a Page (and implicitly Project).

### Global Context (Client-Side)
- **State**: `selectedProjectId`, `selectedPageId` (or "ALL").
- **Persistence**: `localStorage` + Cookies (for SSR compatibility).
- **Behavior**:
    - Force selection of Project -> Page.
    - "All Pages" view aggregates data for the selected Project.

## 1. Database Schema (Prisma)

### New Model: `Project`
- `id` (uuid/cuid)
- `userId` (FK -> User)
- `name` (string)
- `slug` (unique per user)
- `createdAt`, `updatedAt`

### Update Model: `MessengerPage`
- Add `projectId` (FK -> Project, nullable initially).
- Add `userId` (FK -> User).
- Index on `userId`, `projectId`.
- Unique constraint on `userId, pageId`.

### Update Data Models
- Ensure `Contact`, `AutomationRule`, `BroadcastCampaign`, `MessageLog` all have `pageId`.
- `AutomationRule`: Migration from `pageIds[]` to single `pageId` (if strictly 1:1) or ensure strict filtering. *User says "Toda regra... deve carregar pageId"*.
- `Contact`: Ensure `pageId` is populated and used for scoping.

## 2. Backend & Scoping

### Helpers
- `getUserScope(session)`: Returns `{ userId, projectId, pageIds[] }`.
- `requirePageContext(req)`: Validates that a page is selected and belongs to the user.

### Webhooks
- Lookup `MessengerPage` by `entry.id` (FB Page ID).
- Use the correct `pageAccessToken`.
- Attach `pageId` (DB ID) to all created records (Logs, Contacts).

## 3. UI Implementation

### 3.1 Project Management (`/projects`)
- List Projects.
- Create/Edit/Delete Project.
- Validation: Cannot delete if pages are attached (or reassignment flow).

### 3.2 Page Connection (`/integrations/pages`)
- "Connect Facebook" (OAuth).
- List fetched pages.
- Dropdown to assign each page to a Project.
- Save association.

### 3.3 Global Selector (TopBar)
- Dropdown: Project.
- Dropdown: Page (Dependent on Project).
- Option: "All Pages".

### 3.4 Dashboards & Lists
- Update all data fetching (Server Actions / APIs) to respect `selectedPageId`.
- Dashboard items (Counters, Charts):
    - If `selectedPageId` set: Filter by `pageId`.
    - If "ALL": Filter by `projectId` matching pages.

## 4. Migration & Compatibility
- **Seed/Migration**: Create a default "My Project" for existing users if needed.
- **Transition**: Map existing Pages to the default Project.

## 5. Checklist
- [x] Prisma Schema Update & Push
- [x] Project CRUD UI (`/projects` + Actions)
- [x] Connect Pages UI (`/settings/integracoes` with Project Assignment)
- [x] Global Context Store & Selector Component (TopBar)
- [x] Server-Side Scoping Helper (`src/lib/user-scope.ts`)
- [ ] Update Dashboard Queries (Pending integration in specific dashboard pages)
- [ ] Update Automation/Broadcast Queries
- [ ] Webhook Page Resolution
