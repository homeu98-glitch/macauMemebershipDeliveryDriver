# Report Plan

## Meta
- **Type**: PRD / product draft
- **Topic**: Android delivery driver app with order intake, rider workflow, and Amap navigation
- **Audience**: Founder, product, and engineering
- **Language**: English

## Theme
- **Name**: Indigo Dusk
- **Colors**:
  - Background: `#f5f7fa`
  - Surface: `#ffffff`
  - Text: `#0e1322`
  - Text Muted: `#5a647a`
  - Border: `#e2e6ee`
  - Primary: `#4a36e3`
  - Secondary: `#ece8ff`
- **Document Font**: CrimsonPro
- **Monospace Font**: IBMPlexMono

## Structure
1. Product direction — define the app goal and what kind of rider workflow it should support
2. Reference signals — summarize what public Aomi and Meituan rider product descriptions suggest
3. MVP scope — define the smallest useful first release
4. User flow and screens — describe rider journey and key app pages
5. Backend and data model — propose Supabase structure and integration boundary with the external website
6. Navigation design — explain how shop and customer routing should work with Amap
7. Risks and security — highlight service-role handling, permissions, and operational risks
8. Build recommendation — propose implementation phases and next steps

## Visuals
| Visual | Type | Tool | Purpose |
|--------|------|------|---------|
| Rider lifecycle | Flow diagram | HTML/CSS | Show order state transitions |
| App screens | UI mockup | HTML/CSS | Show first-pass screen layout |
| Architecture | Block diagram | HTML/CSS | Show app, sync service, Supabase, external website, and Amap |

## Key Arguments / Thesis
- The first version should focus on a narrow rider workflow: sign in, go online, receive assigned orders, navigate, update delivery status, and review earnings.
- Supabase should be the system of record for the mobile app, while the external website feeds orders through a server-side sync layer.
- Amap should be used for embedded map display and navigation entry, but production use requires privacy-compliance calls and commercial licensing review.
- The Supabase `service_role` key must never be embedded in the Android app and should be rotated before development continues.
