# SiteSupply design system

Adapted from the Linear DESIGN.md in [VoltAgent/awesome-claude-design](https://github.com/VoltAgent/awesome-claude-design) (MIT): a dark, product-first canvas where the product's own UI is the main visual. It has been recoloured with SiteSupply's brand. No Linear branding, typeface or colour is used.

## Atmosphere
A calm night-shift dispatch console. Near-black canvas, charcoal panels, hairline borders, light grey type. One action colour (steel blue). Safety orange appears only where something is at risk.

## Colour tokens (src/styles/index.css)
| Token | Hex | Role |
|---|---|---|
| canvas | #07090D | page |
| panel | #0D1015 | cards, app chrome |
| raised | #13171E | hover, selected rows, inputs |
| overlay | #1A1F28 | menus, popovers, toasts |
| line / line-strong | #222730 / #323945 | hairlines, input edges |
| ink / ink-2 / muted | #F4F6F8 / #C9D0DA / #8B93A1 | text, all AA on every surface |
| primary | #2F6FDE | buttons (white text 4.7:1) |
| primary-ink | #7FA8F5 | links and highlights on dark |
| accent | #E8833A | risk highlights only |
| good / watch / risk / late | #3FBF85 / #E0B11C / #F0995A / #EF6B6B | status, always with icon and label |

Status colours are never used as chart series. Chart series use primary-ink, then ink-2.

## Type
Inter for everything, JetBrains Mono for numbers in tables, SQL and IDs.
| Role | Size / weight / tracking |
|---|---|
| Display | 56–72px / 600 / −0.035em |
| Section | 40px / 600 / −0.03em |
| Card title | 20–22px / 500 / −0.02em |
| Body | 16–18px / 400 |
| Small | 13–14px / 400–500 |

## Shape and depth
- Buttons and inputs: 8px radius, 40px minimum height.
- Cards: 12px radius, 1px hairline, no drop shadow.
- Product frames: 16px radius, a faint inside top highlight, one deep shadow.
- Depth comes from the surface ladder (canvas → panel → raised → overlay), not from shadows.

## Do
- Lead every section with real product UI running on the data.
- Keep one action colour per view.
- Show status as colour + icon + label.

## Don't
- No gradients as decoration, no glow cards, no pill-shaped CTAs.
- No orange outside risk states.
- No light-mode marketing page.
