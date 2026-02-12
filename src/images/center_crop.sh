#!/bin/bash

mkdir -p cropped_designs

# X=110.6, Y=107.2, W=274.5 (385.1-110.6), H=447 (554.2-107.2)
# We use the --actions flag to "crop" the document itself.

for svg in PLAYING_CARD_*.svg; do
    if [ -f "$svg" ]; then
        echo "Processing $svg..."

        # This tells Inkscape:
        # 1. Open file
        # 2. Select the rectangle area
        # 3. Crop the document to that selection
        # 4. Save
        inkscape "$svg" \
            --actions="select-by-value:x=110,y=107,width=275,height=447;export-area-selection;export-plain-svg;export-do" \
            --export-filename="cropped_designs/center_${svg}"
    fi
done
