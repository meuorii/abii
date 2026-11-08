# Landing concept asset manifest

| Placeholder identifier | Intended final asset | Purpose | Aspect ratio | Recommended resolution | Expected final path | Replacement instructions |
| --- | --- | --- | --- | --- | --- | --- |
| `perspective-study-tiles` | React + CSS + Lucide study tiles (current); optional official 3D renders | Centered hero spatial composition | 1:1 per tile | 800×800–1200×1200 | `public/landing/tiles/` | Replace each individual `PerspectiveTile` only with an approved transparent render; retain the text label. |
| `study-space-preview` | Real subjects/folders/topics capture | Organization showcase | 16:10 | 1920×1200 | `public/landing/study-space-preview.png` | Replace `StudySpacePreview` contents; preserve `object-fit: cover`. |
| `progress-preview` | Real mastery/progress capture | Progress showcase | 16:10 | 1920×1200 | `public/landing/progress-preview.png` | Replace `ProgressPreview` contents; keep the semantic nearby copy. |
| `hero-mascot` | Existing official Abii welcome pose | Hero personality | transparent 4:5 | 1200×1500+ | `public/mascot/welcome.png` | In use now; only replace with an official approved pose with the same transparent bounds. |
| `encouragement-mascot` | Existing official Abii complete pose | Closing encouragement | transparent 1:1 | 1200×1200+ | `public/mascot/complete.png` | In use now; maintain `object-contain` and do not crop or distort. |
