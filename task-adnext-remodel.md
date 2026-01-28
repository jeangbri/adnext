# AdNext Remodel Task

## Objective
Remodel the entire project, renaming it to **AdNext**, focusing 100% on **Messenger** automations, and implementing a new premium design using **Black** and **Messenger Blue**.

## Context
The project was previously "instagram-saas". It is a Monorepo (TurboRepo) with a Next.js web app.
The user requires a complete overhaul of UX, Front, and Back to focus on Messenger.

## Plan

### Phase 1: Branding and Basic Configuration
- [x] Rename project in `package.json` files.
- [x] Update Titles and Metadata in Next.js.
- [x] Update Logo/Branding references (if text based).

### Phase 2: Design System Overhaul (Messenger Theme)
- [x] Update `apps/web/src/app/globals.css` to use Messenger Blue & Black theme.
- [x] Ensure "Premium" feel (gradients, spacing, fonts).
- [x] Update `tailwind.config.ts` if necessary.

### Phase 3: UX/UI Redesign (Messenger Focus)
- [x] Redesign Login Page (Black/Blue).
- [x] Redesign Dashboard Layout.
- [x] Review and update Sidebar/Navigation throughout.

### Phase 4: Functional Shift (Messenger API) & Backend Refactor
- [x] Analyze current Instagram integrations and identify what needs to change to Messenger.
- [x] Rename/Refactor API routes (e.g., `/api/instagram` -> `/api/messenger`).
- [x] Update Webhooks to listen for Messenger events.
- [x] Update Automation/Flow logic for Messenger (`messenger-service.ts`, `Facebook Graph API v19.0`).
- [x] Refactor Database Schema: `InstagramAccount` -> `ConnectedAccount` (generic).

### Phase 5: Cleanup
- [x] Remove Instagram specific branding references.
- [x] Remove old Instagram API routes.

## Status
**COMPLETED**. The project has been fully re-branded to AdNext with a focus on Messenger. Backend services and Database Schema have been refactored to support generic Connected Accounts (Facebook Pages). Design is now Premium Black/Blue.
