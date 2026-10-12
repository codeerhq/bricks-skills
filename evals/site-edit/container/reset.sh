#!/bin/sh
# Restore the fixture exactly, including tables created after the snapshot.
set -e
wp db reset --yes --quiet
wp db import /tmp/harness/fixture.sql --quiet
wp cache flush --quiet || true
wp rewrite flush --quiet || true
