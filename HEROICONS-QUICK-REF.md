# Heroicons Quick Reference

**1,288 SVG icons** from [tailwindlabs/heroicons](https://github.com/tailwindlabs/heroicons) are now available locally in `/static/icons/heroicons/`.

## Available Styles

| Style | Path | Count | Use Case |
| ------- | ------ | ------- | ---------- |
| 24/outline | `24/outline/` | ~300 | Default UI icons (outlined) |
| 24/solid | `24/solid/` | ~300 | Default UI icons (filled) |
| 20/solid | `20/solid/` | ~300 | Smaller UI elements |
| 16/solid | `16/solid/` | ~300 | Micro icons, buttons |

## Usage Methods

### Method 1: Jinja2 Macro (Recommended)

```html
{# In any template that extends base.html #}
{{ heroicon('home', '24/outline', 'hi-nav-icon') }}
{{ heroicon('check-circle', '20/solid', 'hi-success') }}
{{ heroicon('trash', '16/solid', 'hi-btn-icon hi-danger') }}
```

### Method 2: Direct SVG Inline

```html
<svg class="hi-24" viewBox="0 0 24 24">
    <use href="/static/icons/heroicons/24/outline/home.svg"/>
</svg>
```

### Method 3: CSS Background Image

```css
.icon-home {
    background-image: url('/static/icons/heroicons/24/outline/home.svg');
    width: 24px;
    height: 24px;
}
```

## CSS Helper Classes

| Class | Size | Purpose |
| ------- | ------ | --------- |
| `.hi-16` | 16×16px | Micro icons |
| `.hi-20` | 20×20px | Small buttons |
| `.hi-24` | 24×24px | Standard UI |
| `.hi-outline` | - | Stroke styling for outline icons |
| `.hi-solid` | - | Fill styling for solid icons |
| `.hi-nav-icon` | 20×20px | Navigation items |
| `.hi-btn-icon` | 16×16px | Button icons |
| `.hi-card-icon` | 24×24px | Card headers |

## Color Classes

| Class | Color |
| ------- | ------- |
| `.hi-primary` | Red (#e10600) |
| `.hi-secondary` | Gray (#a0a0a0) |
| `.hi-success` | Green (#00c853) |
| `.hi-warning` | Yellow (#ffab00) |
| `.hi-danger` | Red (#ff1744) |

## Common Icons for Mine Management

```html
{# Navigation #}
{{ heroicon('home', '24/outline') }}
{{ heroicon('users', '24/outline') }}
{{ heroicon('truck', '24/outline') }}
{{ heroicon('wrench', '24/outline') }}
{{ heroicon('identification', '24/outline') }}

{# Actions #}
{{ heroicon('plus', '20/solid') }}
{{ heroicon('trash', '16/solid') }}
{{ heroicon('pencil', '16/solid') }}
{{ heroicon('check', '16/solid') }}
{{ heroicon('x-mark', '16/solid') }}

{# Status #}
{{ heroicon('check-circle', '24/solid', 'hi-success') }}
{{ heroicon('exclamation-triangle', '24/solid', 'hi-warning') }}
{{ heroicon('x-circle', '24/solid', 'hi-danger') }}

{# Security #}
{{ heroicon('shield-check', '24/outline') }}
{{ heroicon('lock-closed', '24/outline') }}
{{ heroicon('key', '24/outline') }}
{{ heroicon('qr-code', '24/outline') }}
```

## Works Alongside Tabler Icons

Tabler Icons (via CDN) remain the primary icon system:

```html
<i class="ti ti-dashboard"></i>  {# Tabler - still works #}
{{ heroicon('home', '24/outline') }}  {# Heroicons - new option #}
```

## Icon Search

Browse all icons at [heroicons.com](https://heroicons.com/) or search locally:

```bash
ls static/icons/heroicons/24/outline/ | grep "search-term"
```
