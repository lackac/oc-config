---
name: iterating-with-openscad
description: Use when creating or modifying OpenSCAD models - renders models to PNG and uses Read tool for visual verification, enabling autonomous iteration based on actual appearance rather than mathematical validation
---

# Iterating with OpenSCAD

## Overview

**Core principle:** Visual verification beats mathematical validation. Always
render and view the output.

OpenSCAD models can be syntactically correct and geometrically valid but
visually wrong. The only way to verify a model matches requirements is to render
it to PNG and view it with Read tool.

## When to Use

**Use this skill when:**

- Creating or modifying OpenSCAD models
- User describes visual requirements ("rounded corners", "looks right", "fits
  together")
- Verifying dimensions, proportions, or aesthetics
- Iterating on design until correct

## The Render-View-Iterate Cycle

Every OpenSCAD task follows this cycle:

```
1. Write/modify .scad code
2. Render to PNG image
3. View with Read tool
4. Analyze what you see
5. If wrong → iterate (back to step 1)
6. If correct → done
```

**Never skip steps 2-4.** You cannot verify visually without rendering and
viewing.

## Quick Reference

| Task             | Command                                               |
| ---------------- | ----------------------------------------------------- |
| Render to PNG    | `openscad -o output.png --imgsize=800,600 model.scad` |
| View PNG         | `Read tool on output.png`                             |
| Multiple views   | `--camera=x,y,z,rx,ry,rz,d` or `--viewall`            |
| Auto-fit view    | `--viewall` (recommended for first render)            |
| Auto-center view | `--autocenter`                                        |

## Implementation

### Basic Workflow

```bash
# 1. Render model to PNG
openscad -o model.png --imgsize=800,600 --viewall --autocenter model.scad

# 2. View with Read tool
# Use Read tool on model.png

# 3. Analyze what you see
# - Does it match requirements?
# - Are dimensions visually correct?
# - Do features look right?
# - Are there visual issues?

# 4. If wrong, modify .scad and repeat from step 1
```

### Multiple Views for Complex Models

```bash
# Render different angles to see all features
openscad -o model-angle1.png --imgsize=800,600 --viewall --autocenter model.scad
openscad -o model-angle2.png --imgsize=800,600 --camera=50,50,50,60,0,45,150 model.scad
```

### Complete Iteration Example

```scad
// rounded-cube.scad - First attempt
cube([20, 20, 20], center=true);
```

Render:
`openscad -o cube.png --imgsize=800,600 --viewall --autocenter rounded-cube.scad`

View with Read tool: **Corners are sharp!** Need rounding.

```scad
// rounded-cube.scad - Second iteration
radius = 2;
minkowski() {
    cube([16, 16, 16], center=true);
    sphere(r=radius, $fn=32);
}
```

Render:
`openscad -o cube.png --imgsize=800,600 --viewall --autocenter rounded-cube.scad`

View with Read tool: **Corners now properly rounded!** ✓

## Common Mistakes

| Mistake                              | Reality                                                  |
| ------------------------------------ | -------------------------------------------------------- |
| "Syntax is correct"                  | Syntax ≠ visual correctness. Render and view.            |
| "STL generated successfully"         | STL is for 3D printer, not for verification. Render PNG. |
| "Facet count confirms geometry"      | Math ≠ visual verification. Render and view.             |
| "Manifold object validates"          | Topology ≠ appearance. Render and view.                  |
| "Code looks right"                   | Code ≠ visual output. Render and view.                   |
| Describing what it "should" show     | Guessing ≠ viewing. Use Read tool.                       |
| Only rendering once                  | Render after EVERY change.                               |
| Skipping render for "simple" changes | All changes need visual verification.                    |

## Red Flags - STOP and Render

- "Dimensions are mathematically valid"
- "Geometry checks out"
- Making changes without rendering
- Claiming done without viewing output
- "The model should look like..."

**All of these mean: Stop. Render to PNG. Use Read tool. Verify visually.**

## When Iteration is Complete

✅ Done when:

- Rendered to PNG after latest changes
- Viewed image with Read tool
- Visually verified against ALL requirements
- Model appearance matches what user wants

❌ NOT done if:

- Only checked syntax or geometry
- Generated STL but no PNG verification
- Haven't viewed rendered output
- Made changes but didn't re-render

## Real-World Impact

**Without visual verification:**

- Holes wrong size → parts don't fit
- Proportions off → looks wrong
- Subtle issues missed → expensive 3D printing mistakes

**With visual verification:**

- Catch issues immediately
- Fast iteration based on what you see
- Deliver exactly what user wants
- Save time and materials
