# Manual Audit Monitor

This local monitor protects the long-running Kakobuy catalog review from session interruption. It treats one `sourceProductId` as one audit unit, so all price-group records for the same source product are reviewed together. The current catalog contains 2,192 price-group records and 1,153 unique source products.

## Start the monitor

From the repository root, run:

```bash
python3 scripts/monitor-manual-audit.py
```

The monitor refreshes the queue every 180 seconds. It writes the current state to `scripts/audit-progress.json` and the next review batch to `scripts/audit-next-batch.md`. Keep this terminal open and keep the computer connected while the audit is in progress.

## Resume after interruption

Run the same command again. The monitor reconstructs the reviewed set from `scripts/manual-product-review-log.md`, so it does not depend only on process memory. Review the item shown in `audit-next-batch.md`, append a dated review entry containing `Source product ID: \`...\`` to the log, and add a `MANUAL_OVERRIDES` entry only when the product needs a category, subcategory, or primary-image correction. The next three-minute heartbeat will recalculate the queue.

For a one-time check, use:

```bash
python3 scripts/monitor-manual-audit.py --once
```

The default interruption threshold is 420 seconds. If the heartbeat is older than that, the monitor prints a warning and points back to `audit-next-batch.md`. A stale heartbeat does not fabricate a review or modify product classifications.

## Completion rule

When every unique source product has a review entry, the state changes to `complete`, records `completedAt`, prints a completion message, and stops the loop automatically. The final state remains available for audit history and deployment review.

## Important limitation

This is a local progress monitor and resume queue. It does not invent visual judgments, fake review content, or silently mark products as reviewed. Browser-based product inspection remains a deliberate human action; the durable log is the source of truth.
