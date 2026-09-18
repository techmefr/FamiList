#!/bin/sh
# Rewrites the instance configuration before nginx starts.
#
# The build left a `config.js` holding whatever the environment said at the time, usually nothing. This is
# where it takes the values of *this* container, which is what lets one published image serve any family's
# database instead of one rebuild per instance.
#
# Missing variables are not an error: the app then shows the screen that says so, which is more useful than
# a container refusing to start with a message nobody will read.
set -e

escape() {
	printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

cat > /usr/share/nginx/html/config.js <<EOF
window.__FAMILIST_CONFIG__ = { "url": "$(escape "${PUBLIC_SUPABASE_URL}")", "anonKey": "$(escape "${PUBLIC_SUPABASE_ANON_KEY}")" };
EOF
