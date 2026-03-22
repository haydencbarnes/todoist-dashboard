## Design Context

### Users
Todoist power users and productivity enthusiasts who want deeper insight into their task completion habits, patterns, and trends. They use this dashboard to reflect on their work, spot opportunities for improvement, and feel good about their progress. The context is typically end-of-day or weekly review sessions — a contemplative, unhurried moment.

### Brand Personality
**Warm, Focused, Calm.**

The dashboard is a cozy productivity companion — like a well-organized desk under warm lamp light. It should feel inviting and grounding, never overwhelming or clinical. The interface respects the user's attention and rewards it with clarity.

### Emotional Goals
Users should feel:
- **Calm confidence** — "I'm on track, I can see the big picture"
- **Motivated momentum** — "I'm doing great, let's keep going"
- **Curious insight** — "Oh interesting, I didn't know that about myself"
- **Proud reflection** — "Look at everything I've accomplished"

### Aesthetic Direction
- **Visual tone:** Warm dark mode with thoughtful, beautiful details. Not minimal for minimalism's sake — every element should feel considered and intentional.
- **References:** Raycast / Arc — warm dark palettes, personality in micro-interactions, professional but not sterile.
- **Anti-references:** Generic dashboards with harsh neon on black. Cold, corporate BI tools. Overly playful/gamified interfaces.
- **Theme:** Dark only. The warm color palette (peach #FF9B71, sage #7FD49E, soft blue #8BB4E8) on near-black backgrounds is the identity.

### Color System
| Token | Hex | Role |
|-------|-----|------|
| warm-black | #0D0D0D | Background |
| warm-card | #1A1A1A | Card surfaces |
| warm-hover | #202020 | Hover states |
| warm-border | #2A2A2A | Borders, dividers |
| warm-peach | #FF9B71 | Primary accent, CTAs |
| warm-sage | #7FD49E | Success, positive trends |
| warm-blue | #8BB4E8 | Secondary accent, info |
| warm-gray | #9CA3AF | Muted text, labels |
| warm-danger | #E57373 | Errors, overdue, negative trends |
| warm-warning | #FFB74D | Caution, stale items |

### Design Principles

1. **Warmth over coldness.** Use the warm palette consistently. Rounded corners (2xl), soft shadows, and organic colors. The interface should feel approachable, never sterile.

2. **Clarity over density.** Give data room to breathe. Generous spacing, clear hierarchy, and purposeful whitespace. Each section should be scannable at a glance.

3. **Thoughtful details.** Micro-interactions, smooth transitions, and subtle polish signal care. Framer Motion animations should feel natural (spring physics, not linear). Every hover state, loading skeleton, and tooltip should feel intentional.

4. **Data tells a story.** Charts and metrics should surface insight, not just numbers. Use color, hierarchy, and context to help users understand what the data means for them.

5. **Respect the user's attention.** No unnecessary chrome, decorative noise, or competing focal points. Progressive disclosure — show what matters first, let users dig deeper when they want to.

### Typography
- **Font:** Inter (system fallback: system-ui, sans-serif)
- **Headings:** Semi-bold to bold, sized for clear hierarchy (h1: 2.5rem, h2: 2rem, h3: 1.5rem)
- **Body:** Regular weight, #F5F5F5 on dark backgrounds
- **Labels/secondary:** text-sm in warm-gray (#9CA3AF)

### Component Patterns
- **Cards:** `bg-warm-card border border-warm-border rounded-2xl p-4-6`
- **Buttons (primary):** `bg-warm-peach text-white rounded-xl px-4 py-2 hover:opacity-90`
- **Buttons (secondary):** `bg-warm-hover border border-warm-border text-white rounded-xl`
- **Transitions:** `transition-colors duration-200` or Framer Motion with spring physics
- **Loading:** Pulse-animated skeletons matching card layout

### Accessibility
- Keyboard navigation on all interactive elements
- `prefers-reduced-motion` respected via Framer Motion's `useReducedMotion`
- Semantic HTML with ARIA labels on icon buttons
- Current implementation is sufficient; no additional WCAG targets required
