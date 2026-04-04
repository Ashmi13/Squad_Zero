# 🎨 Design System

Design tokens and specifications based on the Figma UI design.

## Color Palette

### Primary Colors (Blue)

```css
--primary-50: #f0f9ff /* Light background */ --primary-100: #e0f2fe /* Hover states */
  --primary-500: #3b82f6 /* Primary brand color */ --primary-600: #2563eb
  /* Buttons, links (default) */ --primary-700: #1d4ed8 /* Hover/active states */;
```

### Neutral Colors (Grays)

```css
--neutral-50: #fafafa /* Backgrounds */ --neutral-100: #f5f5f5 /* Light backgrounds */
  --neutral-200: #e5e5e5 /* Borders */ --neutral-300: #d4d4d4 /* Dividers, borders */
  --neutral-400: #a3a3a3 /* Placeholder text */ --neutral-500: #737373 /* Secondary text */
  --neutral-600: #525252 /* Body text */ --neutral-700: #404040 /* Headings */
  --neutral-800: #262626 /* Dark text */ --neutral-900: #171717 /* Primary text */;
```

### Semantic Colors

```css
--error: #ef4444 /* Errors, validation */ --success: #22c55e /* Success messages */
  --warning: #f59e0b /* Warnings */ --info: #3b82f6 /* Information */;
```

## Typography

### Font Family

```css
font-family:
  'Inter',
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
  sans-serif;
```

### Font Sizes

```css
--text-xs: 0.75rem /* 12px - Small labels */ --text-sm: 0.875rem /* 14px - Body text, inputs */
  --text-base: 1rem /* 16px - Default */ --text-lg: 1.125rem /* 18px - Subheadings */
  --text-xl: 1.25rem /* 20px - Headings */ --text-2xl: 1.5rem /* 24px - Page title */
  --text-3xl: 1.875rem /* 30px - Hero text */;
```

### Font Weights

```css
--font-normal: 400 --font-medium: 500 --font-semibold: 600 --font-bold: 700;
```

## Spacing Scale

```css
--space-1: 0.25rem /*  4px */ --space-2: 0.5rem /*  8px */ --space-3: 0.75rem /* 12px */
  --space-4: 1rem /* 16px */ --space-5: 1.25rem /* 20px */ --space-6: 1.5rem /* 24px */
  --space-8: 2rem /* 32px */ --space-10: 2.5rem /* 40px */ --space-12: 3rem /* 48px */;
```

## Border Radius

```css
--radius-sm: 0.25rem /*  4px - Small elements */ --radius-md: 0.375rem /*  6px - Inputs, buttons */
  --radius-lg: 0.5rem /*  8px - Cards */ --radius-xl: 0.75rem /* 12px - Modal */ --radius-2xl: 1rem
  /* 16px - Card container */ --radius-full: 9999px /* Pills, avatars */;
```

## Shadows

### Card Shadow

```css
box-shadow:
  0 4px 6px -1px rgba(0, 0, 0, 0.1),
  0 2px 4px -1px rgba(0, 0, 0, 0.06);
```

### Input Shadow

```css
box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
```

### Hover Shadow

```css
box-shadow:
  0 10px 15px -3px rgba(0, 0, 0, 0.1),
  0 4px 6px -2px rgba(0, 0, 0, 0.05);
```

## Component Specifications

### Login Card

```css
Width: 100% (max-width: 28rem / 448px)
Padding: 2rem (32px) - mobile: 2.5rem (40px) - desktop
Background: #ffffff
Border Radius: 1rem (16px)
Shadow: card shadow
```

### Buttons

#### Primary Button

```css
Background: #2563eb (primary-600)
Text Color: #ffffff
Padding: 0.75rem 1.5rem (12px 24px)
Border Radius: 0.5rem (8px)
Font Weight: 500
Font Size: 0.875rem (14px)
Shadow: 0 1px 2px rgba(0,0,0,0.05)

Hover:
  Background: #1d4ed8 (primary-700)
  Shadow: 0 4px 6px rgba(0,0,0,0.1)
```

#### OAuth Button

```css
Background: #ffffff
Text Color: #404040 (neutral-700)
Border: 1px solid #d4d4d4 (neutral-300)
Padding: 0.75rem 1rem (12px 16px)
Border Radius: 0.5rem (8px)
Font Weight: 500
Font Size: 0.875rem (14px)

Hover:
  Background: #fafafa (neutral-50)
  Border Color: #a3a3a3 (neutral-400)
```

### Input Fields

```css
Background: #ffffff
Border: 1px solid #d4d4d4 (neutral-300)
Padding: 0.75rem 1rem (12px 16px)
Border Radius: 0.5rem (8px)
Font Size: 0.875rem (14px)
Text Color: #171717 (neutral-900)
Placeholder Color: #a3a3a3 (neutral-400)

Focus:
  Border Color: #2563eb (primary-600)
  Ring: 2px #3b82f6 (primary-500) at 2px offset

Error:
  Border Color: #ef4444 (red-500)
  Ring: 2px #ef4444 at 2px offset
```

### Labels

```css
Font Size: 0.875rem (14px)
Font Weight: 500
Color: #404040 (neutral-700)
Margin Bottom: 0.5rem (8px)
```

### Error Messages

```css
Font Size: 0.875rem (14px)
Color: #dc2626 (red-600)
Icon: ⚠ or Alert Circle
Margin Top: 0.375rem (6px)
```

### Links

```css
Font Size: 0.875rem (14px)
Font Weight: 500
Color: #2563eb (primary-600)

Hover:
  Color: #1d4ed8 (primary-700)
  Underline: optional
```

## Layout

### Responsive Breakpoints

```css
Mobile:  < 640px (default)
Tablet:  >= 640px (sm:)
Desktop: >= 1024px (lg:)
```

### Container Padding

```css
Mobile:  1rem (16px)
Tablet:  1.5rem (24px)
Desktop: 2rem (32px)
```

### Form Spacing

```css
Between fields: 1.25rem (20px)
Between sections: 1.5rem (24px)
Between form and footer: 2rem (32px)
```

## Icons

### Icon Size

```css
Small:  1rem (16px)
Medium: 1.25rem (20px)
Large:  1.5rem (24px)
```

### Icon Colors

```css
Default: #a3a3a3 (neutral-400)
Hover: #737373 (neutral-500)
Active: #525252 (neutral-600)
```

## Animations

### Transitions

```css
Fast: 150ms ease-in-out
Normal: 200ms ease-in-out
Slow: 300ms ease-in-out
```

### Loading Spinner

```css
Animation: spin 1s linear infinite
Border Width: 2px
Border Color: rgba(255, 255, 255, 0.3)
Border Top Color: #ffffff (white)
```

### Fade In

```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
duration: 300ms ease-in-out;
```

## Accessibility

### Focus Visible

```css
Outline: 2px solid #3b82f6 (primary-500)
Outline Offset: 2px
```

### Minimum Touch Target

```css
Minimum Size: 44px × 44px
```

### Color Contrast

```css
Text on White:
  - Body text (neutral-700): 9.7:1 ✅
  - Secondary text (neutral-500): 5.2:1 ✅
  - Placeholder (neutral-400): 3.4:1 ⚠️

Primary Button:
  - White on Primary-600: 4.9:1 ✅
```

## Usage Examples

### Tailwind Classes

**Primary Button:**

```html
<button
  class="px-6 py-3 bg-primary-600 text-white font-medium text-sm rounded-lg shadow-sm hover:bg-primary-700 hover:shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
>
  Sign In
</button>
```

**Input Field:**

```html
<input
  class="w-full px-4 py-3 bg-white border border-neutral-300 rounded-lg text-neutral-900 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
/>
```

**Card Container:**

```html
<div class="bg-white rounded-2xl shadow-card p-8 sm:p-10">
  <!-- Content -->
</div>
```

## Design Principles

1. **Consistency**: Use spacing scale consistently
2. **Simplicity**: Clean, minimal design
3. **Accessibility**: WCAG AA compliant
4. **Responsiveness**: Mobile-first approach
5. **Performance**: Optimize for fast load times
6. **Clarity**: Clear visual hierarchy

---

**Note:** All measurements are based on a 16px base font size (1rem = 16px)
