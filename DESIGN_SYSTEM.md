# Quizzy Design System Documentation

## Overview

Quizzy uses a unified, professional design system inspired by Linear, Vercel, and Supabase. The system ensures visual consistency across all pages and components with a dark theme aesthetic suitable for a premium learning platform.

---

## Design Principles

### Philosophy
- **Compact SaaS layouts** - Minimal whitespace, focused information hierarchy
- **Subtle shadows** - Soft elevation effects for depth without drama
- **Soft borders** - Consistent 1px borders for component separation
- **Professional spacing** - Restrained, predictable 4px-based unit system
- **Consistent typography** - Clear visual hierarchy using Inter font
- **Restrained animations** - Smooth 150ms-300ms transitions only

### What We Avoid
- ❌ Random gradients or decorative backgrounds
- ❌ Excessive glow effects or neon colors
- ❌ Floating circles or decorative blobs
- ❌ Oversized shadows or glass-morphism effects
- ❌ Childish or playful styling
- ❌ Inconsistent color palettes
- ❌ Excessive border radius values

---

## Color Palette

### Dark Theme (Default)

All pages use the dark theme by default. Optional light mode available via `body.light` class.

#### Core Colors
```
Background:      #0F1117  (--color-bg-base)
Surface 1:       #161B22  (--color-surface-1)
Surface 2:       #1C2128  (--color-surface-2)
Surface 3:       #21262D  (--color-surface-3)
Card/Container:  #1C2128  (--color-surface-2)
Border:          #2D333B  (--color-border-default)
```

#### Text Colors
```
Primary Text:    #F8FAFC  (--color-text-primary)
Secondary Text:  #94A3B8  (--color-text-secondary)
Tertiary Text:   #64748B  (--color-text-tertiary)
Muted Text:      #475569  (--color-text-muted)
```

#### Accent Color
```
Primary:         #6366F1  (--color-accent) - Main brand indigo
Light:           #818CF8  (--color-accent-light)
Dark:            #4F46E5  (--color-accent-dark)
Lightest:        #312E81  (--color-accent-lightest)
```

#### Semantic Colors
```
Success:         #16A34A  (Green)
Warning:         #EA580C  (Orange)
Error:           #DC2626  (Red)
Info:            #0EA5E9  (Cyan)

Plus background and light variants for each
```

---

## Spacing System

4px-based unit system (base unit = 4px)

```
--space-0:   0
--space-1:   4px
--space-2:   8px
--space-3:   12px
--space-4:   16px (default padding)
--space-5:   20px
--space-6:   24px (large padding)
--space-7:   28px
--space-8:   32px (section spacing)
--space-10:  40px
--space-12:  48px
--space-16:  64px
```

### Usage Guidelines
- **Cards/Containers**: `padding: var(--space-4)` or `var(--space-6)`
- **Sections**: `gap: var(--space-6)` between major sections
- **Groups**: `gap: var(--space-3)` or `var(--space-4)` between item groups
- **Compact elements**: `gap: var(--space-2)` for tight layouts

---

## Typography

### Font Family
`Inter` - system-ui fallback for all text

### Font Sizes
```
xs:      12px  (--font-size-xs)   - Labels, badges, hints
sm:      14px  (--font-size-sm)   - Secondary text, captions
base:    16px  (--font-size-base) - Body text, standard
lg:      18px  (--font-size-lg)   - Larger body, intro text
xl:      20px  (--font-size-xl)   - Section headings
2xl:     24px  (--font-size-2xl)  - Page subheadings
3xl:     30px  (--font-size-3xl)  - Page headings
4xl:     36px  (--font-size-4xl)  - Large headings
5xl:     48px  (--font-size-5xl)  - Hero/main headings
```

### Font Weights
```
400: Regular    (--font-weight-regular)
500: Medium     (--font-weight-medium)
600: Semibold   (--font-weight-semibold) - Default for headings
700: Bold       (--font-weight-bold)
800: Extrabold  (--font-weight-extrabold) - Badges, emphasis
```

### Heading Classes
```
.heading-1  → h1   (5xl, bold)
.heading-2  → h2   (4xl, bold)
.heading-3  → h3   (3xl, bold)
.heading-4  → h4   (2xl, semibold)
.heading-5  → h5   (xl, semibold)
.heading-6  → h6   (lg, semibold)
```

---

## Border Radius

Restrained radius values for clean look

```
--radius-sm:    4px  - Inputs, small elements
--radius-md:    8px  - Buttons, cards, fields
--radius-lg:    12px - Large cards, modals
--radius-xl:    16px - Extra large containers
--radius-2xl:   20px - Hero sections
--radius-full:  9999px - Pill shapes (badges, pills)
```

---

## Shadows

Subtle shadows for elevation only

```
--shadow-xs:   0 1px 2px rgba(0,0,0, 0.3)
--shadow-sm:   0 1px 3px rgba(0,0,0, 0.4), 0 1px 2px rgba(0,0,0, 0.3)
--shadow-md:   0 4px 6px rgba(0,0,0, 0.4), 0 2px 4px rgba(0,0,0, 0.3)
--shadow-lg:   0 10px 15px rgba(0,0,0, 0.4), 0 4px 6px rgba(0,0,0, 0.3)
--shadow-xl:   0 20px 25px rgba(0,0,0, 0.4), 0 10px 10px rgba(0,0,0, 0.3)
```

### Usage
- Cards: `box-shadow: var(--shadow-sm)`
- Dropdowns/Modals: `box-shadow: var(--shadow-md)`
- Floating panels: `box-shadow: var(--shadow-lg)`

---

## Transitions

Smooth animations with consistent timing

```
--transition-fast:  150ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-base:  200ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-slow:  300ms cubic-bezier(0.4, 0, 0.2, 1)
```

---

## Z-Index Scale

Structured layers for proper stacking

```
--z-base:       1
--z-dropdown:   100
--z-sticky:     200
--z-fixed:      300
--z-modal:      500
--z-toast:      600
--z-tooltip:    700
```

---

## Components

### Cards & Panels

```css
.card {
  background-color: var(--color-surface-1);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--space-6);
}

.panel {
  /* Same as .card but for containers */
}
```

### Buttons

```css
.btn-primary {
  background-color: var(--color-accent);
  color: white;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-weight: var(--font-weight-semibold);
}

.btn-primary:hover {
  background-color: var(--color-accent-dark);
}

.btn-secondary {
  background-color: var(--color-surface-2);
  border: 1px solid var(--color-border-default);
  color: var(--color-text-primary);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.btn-secondary:hover {
  background-color: var(--color-surface-3);
  border-color: var(--color-accent);
}
```

### Form Inputs

```css
.input,
.textarea,
.select {
  background-color: var(--color-surface-2);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  color: var(--color-text-primary);
  font-family: var(--font-family-base);
}

.input:focus,
.textarea:focus,
.select:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}
```

### Navigation

```css
.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  background-color: var(--color-surface-1);
  border-bottom: 1px solid var(--color-border-default);
  box-shadow: var(--shadow-xs);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
}
```

### Status Indicators

```css
.status-success {
  background-color: var(--color-success-bg);
  color: var(--color-success-light);
}

.status-error {
  background-color: var(--color-error-bg);
  color: var(--color-error-light);
}

.status-warning {
  background-color: var(--color-warning-bg);
  color: var(--color-warning-light);
}
```

---

## File Structure

```
frontend/
├── design-system.css          # Core design tokens (imports in all pages)
├── styles-app-clean.css       # Main app components (home, dashboard, etc.)
├── styles-auth-clean.css      # Authentication pages (login, register)
├── styles-arcade-clean.css    # Arcade/game pages
├── js/
│   └── games/
│       └── arcade-games-clean.css  # Game-specific styles
└── *.html                     # All HTML pages using the design system
```

### CSS Organization

1. **design-system.css** - Source of truth
   - CSS custom properties (variables)
   - Global styles (reset, body, headings)
   - Utility classes
   - No component-specific styling

2. **Component CSS files** - Feature-specific
   - Import design-system.css first
   - Define component classes using design tokens
   - No hardcoded colors/spacing
   - Responsive breakpoints included

---

## Responsive Breakpoints

Mobile-first approach:

```css
/* Mobile (default) */
@media (max-width: 768px) {
  /* Tablet adjustments */
}

@media (max-width: 1024px) {
  /* Small desktop adjustments */
}

/* Default: large screens (1024px+) */
```

---

## Usage Guide

### DO's ✅
- Use CSS custom properties from design-system.css
- Use semantic color variables (--color-success, etc.)
- Follow the 4px spacing grid
- Use Inter font throughout
- Apply transitions for interactions
- Use appropriate border radius values
- Keep shadows subtle

### DON'Ts ❌
- Don't hardcode colors (use variables)
- Don't use inline styles
- Don't create new gradient backgrounds
- Don't use excessive shadows
- Don't use arbitrary spacing values
- Don't use non-Inter fonts
- Don't use overly bright or saturated colors

---

## Accessing the Design System

All CSS files automatically import `design-system.css`:

```css
/* In component CSS files */
@import "./design-system.css";

/* Then use anywhere */
.my-component {
  color: var(--color-text-primary);
  padding: var(--space-4);
  background: var(--color-surface-2);
  border-radius: var(--radius-md);
}
```

---

## Theme Switching (Optional)

Default is dark theme. To enable light theme:

```javascript
// Add .light class to body
document.body.classList.add('light');
```

Or in HTML:
```html
<body class="light">
  <!-- Page content -->
</body>
```

---

## Component Examples

### Card
```html
<div class="card">
  <h3>Card Title</h3>
  <p class="text-secondary">Card content goes here.</p>
</div>
```

### Button
```html
<button class="btn-primary">Action Button</button>
<button class="btn-secondary">Secondary Action</button>
```

### Form Field
```html
<div style="margin-bottom: var(--space-4)">
  <label>Field Label</label>
  <input class="input" type="text" placeholder="Enter text..." />
</div>
```

### Navigation Bar
```html
<header class="top-nav">
  <div class="brand">
    <div class="brand-badge">Q</div>
    <span>Quizzy</span>
  </div>
  <nav class="nav-links">
    <a href="#" class="nav-link">Dashboard</a>
    <a href="#" class="nav-link">Profile</a>
  </nav>
</header>
```

---

## Maintenance & Updates

### To Update a Design Token
1. Edit `design-system.css` - all components automatically inherit changes
2. No need to update component files
3. Changes apply globally across all pages

### To Add New Colors
1. Add to `:root` in `design-system.css`
2. Follow naming convention: `--color-[category]-[variant]`
3. Update light theme variant in `body.light` if needed

### To Modify Components
1. Edit corresponding component CSS file
2. Maintain use of design system variables
3. Test responsive breakpoints
4. Verify dark/light theme compatibility

---

## Best Practices

1. **Always use variables** - Never hardcode values
2. **Consistent naming** - Follow established patterns
3. **Mobile-first** - Design for mobile, enhance for desktop
4. **Accessibility** - Maintain sufficient color contrast
5. **Performance** - Minimize animation complexity
6. **Documentation** - Comment non-obvious styling decisions
7. **Testing** - Verify across all pages and themes

---

## Support

For design system questions or updates, refer to this documentation and ensure all CSS files use the design tokens from `design-system.css`.

Last updated: May 2026
