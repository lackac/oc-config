# Visual languages

Choose a language that clarifies the subject and fits the audience. The user may
select a preset, provide a reference, describe a custom style, or combine two
languages. Translate that direction into concrete design tokens in `brief.json`.
Use reference images for composition and treatment; record the sources of assets
that actually appear in the video.

## Whiteboard

Best for causal explanations, teaching, and step-by-step mechanisms.

- White or warm-white ground, dark marker strokes, and one or two accent colors.
- Simple illustrated objects, consistent line weight, ample empty space.
- Reveal strokes along their paths, then add short labels. Retain useful drawings
  as new ideas connect to them; avoid clearing the board after every sentence.
- Handwritten titles can add character; small explanatory text must remain legible.

## Collage

Best for stories, playful analogies, and human or cultural subjects.

- Paper cutouts, torn edges, pencil marks, warm textures, and restrained bright accents.
- Layer a few clear silhouettes with subtle shadows and intentional asymmetry.
- Animate placement, shuffling, and small stop-motion-like movements. Keep the
  paper texture stable and seed irregularities so frames do not flicker randomly.
- Pair expressive headings with clean labels. Preserve a clear focal point.

## Technical diagram

Best for software, systems, engineering, architecture, and flows. A good default
for technical subjects when no visual direction was supplied.

- A restrained light or dark background, aligned geometry, clear connectors, and
  color used consistently for roles or states.
- Use a readable sans-serif; reserve monospace for code, identifiers, or values.
- Animate flow along arrows, state changes, grouping, and zooming into detail.
- Keep relationships spatially stable. Use labeled colors and shapes so color
  alone does not carry the explanation.

## Editorial

Best for research summaries, data stories, and polished general-audience explainers.

- A strong grid, generous margins, expressive headlines, and a restrained palette.
- Pair a display face with a readable body face. Use charts, numbered steps,
  sourced images, or a single large metaphor instead of dense paragraphs.
- Animate with measured reveals, framing changes, and simple chart transitions.
- Make evidence, units, and comparisons visible without overwhelming the main idea.

## Kinetic typography

Best for short, energetic explanations built around a few memorable statements.

- Large type, strong contrast, limited colors, and one clear hierarchy.
- Emphasize selected words, numerical comparisons, and transformations; do not
  animate a full transcript word by word unless reliable word timings exist.
- Settle important statements long enough to read. Keep supporting motion calm
  while the viewer processes a new concept.
- Add a diagram when typography alone cannot explain a spatial relationship.

## Interface walkthrough

Best for product features, workflows, and explaining how a tool behaves.

- Use supplied screenshots, recorded UI, or a faithful simplified interface.
- Crop and zoom around the current action; keep cursor, focus, and result visible.
- Use callouts and a consistent device or application frame. Show actual state
  transitions rather than decorative pointer movement.
- Use a purpose-built demo state and assets suitable for the intended audience.

## Custom and mixed directions

Record palette, background, typography, line/shape treatment, imagery, and motion
rules. Carry those tokens across scenes. For a mix, assign roles: for example,
editorial chapter cards with technical diagrams, or collage characters inside a
whiteboard explanation. Avoid unrelated style changes between beats.

For every language, adapt layout to the final aspect ratio instead of cropping a
landscape composition into portrait. At 1080p, start around 32 px for labels and
40 px for captions, then inspect the actual render at its viewing size. Leave safe
margins, limit caption lines, and use contrast and spacing to establish hierarchy.
