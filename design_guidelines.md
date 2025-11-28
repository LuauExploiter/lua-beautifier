# Design Guidelines: Node.js Fullstack Application

## Design Approach
**Selected System:** Material Design 3 with modern developer-focused adaptations
**Rationale:** Fullstack development tools benefit from clean, component-based systems that prioritize functionality and scalability.

## Typography
- **Primary Font:** Inter (Google Fonts) for interface text
- **Monospace Font:** JetBrains Mono for code snippets and technical content
- **Hierarchy:**
  - Display: 2.5rem (40px), font-weight 700
  - Headings: 1.875rem, 1.5rem, 1.25rem, font-weight 600
  - Body: 1rem (16px), font-weight 400
  - Small/Caption: 0.875rem, font-weight 400

## Layout System
**Spacing Units:** Tailwind units of 2, 4, 6, 8, 12, 16, 24
- Component padding: p-6 to p-8
- Section spacing: py-16 to py-24
- Element gaps: gap-4 to gap-6
- Container: max-w-7xl with responsive px-4 to px-8

## Component Library

### Navigation
- **Top Navigation Bar:** Fixed header with logo left, navigation center, user actions right
- Height: h-16
- Include: Search bar, notification bell, user avatar dropdown
- Mobile: Hamburger menu revealing slide-in drawer

### Dashboard Layout
- **Sidebar Navigation:** w-64 with collapsible toggle to w-16 (icon-only)
- Main content area with proper content hierarchy
- Breadcrumb navigation below header

### Cards & Containers
- Rounded corners: rounded-lg (8px)
- Subtle borders with shadow-sm for depth
- Padding: p-6 for card content
- Hover state: Subtle lift with shadow-md transition

### Forms
- **Input Fields:** h-12 with pl-4 padding
- Labels above inputs with mb-2 spacing
- Focus states with ring-2 ring-offset-2
- Error messages in text-sm below fields
- **Buttons:** 
  - Primary: h-12 px-6 rounded-lg font-medium
  - Secondary: Same size with border variant
  - Icon buttons: h-10 w-10 rounded-full

### Data Tables
- Sticky header row
- Row height: h-14
- Zebra striping for readability
- Actions column with icon buttons
- Pagination controls at bottom

### Modals & Dialogs
- Centered with backdrop blur
- Max width: max-w-2xl
- Header with close button
- Footer with action buttons right-aligned

### Status Indicators
- Badges: px-3 py-1 rounded-full text-sm
- Toast notifications: Fixed top-right, auto-dismiss
- Loading states: Skeleton screens or spinner overlays

## Icons
**Library:** Heroicons (outline for most UI, solid for active states)
- Consistent 20px or 24px sizing
- Use via CDN

## Images
**Hero Section:** No large hero image - this is a developer tool focused on functionality
**Usage:** Small avatar images, logo placements, optional dashboard illustrations

## Animations
**Minimal approach:**
- Page transitions: 200ms ease-in-out
- Hover states: 150ms
- Modal/drawer: 300ms slide/fade
- No scroll-triggered or decorative animations

## Page Structure
**Landing/Login Page:**
- Centered authentication form (max-w-md)
- Split layout option: Left form, right testimonial/feature highlights
- Simple footer with links

**Dashboard:**
- Sidebar + main content area
- Header with breadcrumbs
- Content cards in grid layout (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)

**Detail Pages:**
- Two-column when appropriate (2/3 main content, 1/3 sidebar)
- Tab navigation for related content sections
- Action buttons in header area

## Accessibility
- All interactive elements keyboard accessible
- Focus indicators on all inputs and buttons
- ARIA labels for icon-only buttons
- Semantic HTML throughout
- Form validation with clear error messaging

## Key Principles
1. **Function First:** Prioritize usability and developer experience
2. **Consistency:** Reuse spacing, sizing, and component patterns
3. **Scalability:** Design for both minimal and data-heavy states
4. **Responsiveness:** Mobile-first approach with breakpoints at md (768px) and lg (1024px)