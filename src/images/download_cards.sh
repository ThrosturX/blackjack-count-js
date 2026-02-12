#!/bin/bash

SUITS=("CLUBS" "DIAMONDS" "HEARTS" "SPADES")
RANKS=("JACK" "KNIGHT" "QUEEN" "KING")

# MediaWiki requires a User-Agent; change the email to your own if you're doing large batches
USER_AGENT="CardDownloader/1.1 (contact: your@email.com)"

echo "Starting download..."

for suit in "${SUITS[@]}"; do
    for rank in "${RANKS[@]}"; do
        FILE_NAME="PLAYING_CARD_${rank}_OF_${suit}.svg"
        WIKI_URL="https://en.wiktionary.org/wiki/File:${FILE_NAME}"

        echo -n "Fetching $FILE_NAME... "

        # Fetch the page and find the 'Original file' link
        # This looks for the //upload... path inside the href attribute
        SVG_PATH=$(curl -s -L -A "$USER_AGENT" "$WIKI_URL" | \
                   grep -oP 'href="(?=//upload\.wikimedia\.org/)([^"]+\.svg)"' | \
                   head -1 | cut -d'"' -f2)

        if [ -z "$SVG_PATH" ]; then
            echo "FAILED (Link not found)"
        else
            echo "SUCCESS"
            # Download the actual file
            curl -s -L -A "$USER_AGENT" "https:$SVG_PATH" -o "$FILE_NAME"
            # Optional: 1-second pause to avoid hitting rate limits
            sleep 1
        fi
    done
done

echo "Process complete."
