# Theming Guide

This app uses CSS variables for theming, which automatically adapt to light/dark mode.

## How It Works

The theme is controlled by a `data-theme` attribute on the `<html>` element:
- `data-theme="light"` - Light mode
- `data-theme="dark"` - Dark mode

CSS variables automatically change based on this attribute. **You don't need to write separate dark mode styles!**

## Available CSS Variables

### Backgrounds
```css
--bg-primary      /* Main background (light: #f8f9fa, dark: #1a1a1a) */
--bg-secondary    /* Card/section background (light: #ffffff, dark: #2d2d2d) */
--bg-tertiary     /* Alternate background (light: #f8f9fa, dark: #252525) */
```

### Text Colors
```css
--text-primary    /* Main text (light: #333333, dark: #e4e4e4) */
--text-secondary  /* Secondary text (light: #6c757d, dark: #a0a0a0) */
--text-tertiary   /* Tertiary text (light: #555555, dark: #b8b8b8) */
--text-muted      /* Muted text (light: #95a5a6, dark: #707070) */
```

### Borders
```css
--border-color    /* Main border (light: #e9ecef, dark: #404040) */
--border-light    /* Light border (light: #e0e0e0, dark: #3a3a3a) */
```

### Other
```css
--shadow          /* Box shadow (light: rgba(0,0,0,0.1), dark: rgba(0,0,0,0.3)) */
--accent          /* Accent color (light: #3498db, dark: #5dade2) */
```

## Usage Examples

### Option 1: CSS Variables (Recommended)
```svelte
<style>
  .my-component {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .my-button {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  
  .my-button:hover {
    background: var(--bg-tertiary);
  }
</style>
```

### Option 2: Utility Classes
```svelte
<div class="bg-secondary text-primary border-color">
  Content here
</div>

<button class="btn">Regular Button</button>
<button class="btn btn-primary">Primary Button</button>
```

## Common Patterns

### Card/Section
```svelte
<div class="card">
  <h3>Title</h3>
  <p>Content</p>
</div>

<style>
  .card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-light);
    border-radius: 8px;
    padding: 1rem;
  }
  
  h3 {
    color: var(--text-primary);
  }
  
  p {
    color: var(--text-secondary);
  }
</style>
```

### Button
```svelte
<button class="my-btn">Click me</button>

<style>
  .my-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .my-btn:hover {
    background: var(--bg-tertiary);
  }
</style>
```

### Input/Textarea
```svelte
<textarea></textarea>

<style>
  textarea {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    padding: 0.75rem;
    border-radius: 4px;
  }
  
  textarea:focus {
    outline: none;
    border-color: #4285f4;
  }
</style>
```

## ❌ Don't Do This

```svelte
<style>
  /* DON'T hardcode colors */
  .bad {
    background: white;
    color: #333;
  }
  
  /* DON'T use :global(.dark) selectors */
  :global(.dark) .bad {
    background: #2a2a2a;
    color: #e0e0e0;
  }
</style>
```

## ✅ Do This Instead

```svelte
<style>
  /* DO use CSS variables */
  .good {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  /* No dark mode styles needed! */
</style>
```

## Adding New Colors

If you need a new color that should adapt to theme, add it to `src/routes/+layout.svelte`:

```css
:global(:root) {
  --my-new-color: #ff0000;
}

:global([data-theme='dark']) {
  --my-new-color: #ff6666;
}
```

Then use it:
```css
.my-element {
  color: var(--my-new-color);
}
```

## Why This Approach?

1. **Simple**: Just use CSS variables, no framework needed
2. **Automatic**: Dark mode works automatically, no duplicate styles
3. **Maintainable**: Change colors in one place (layout.svelte)
4. **Performant**: No JavaScript needed for theming
5. **Standard**: Uses native CSS features, works everywhere
6. **Flexible**: Easy to add new colors or themes

## Alternative: Tailwind CSS

If you want a more utility-first approach, you could add Tailwind CSS:

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Then use classes like:
```html
<div class="bg-white dark:bg-gray-800 text-black dark:text-white">
```

But honestly, **your current CSS variable approach is already great!** It's what Tailwind uses under the hood anyway.

