"""Notes on the Mind Your Mind summit portrait (kem12-mym.png).

A chroma key was attempted and deliberately abandoned. The banner backdrop is
(13,177,45); the shadowed creases of her mint dress fall inside ~30 of that
same colour, so every threshold that removes the background also punches holes
through the dress. Colour-classified hole filling did not separate them either.

Shipping decision: the crop stays a full-bleed brand-green panel (produced by
process_assets.py as mym-drkem-green.webp) with rounded corners and a soft
inner edge in CSS. That reads as an intentional colour block rather than a
failed cutout, and the green matches the section theme.

Revisit only with a matte source or a segmentation model — not a colour key.
"""
