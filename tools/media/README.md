# Catalog image processing

The user chose local batch processing with code. No generative image editing is used. For avatars, original product RGB pixels remain intact outside the detected website/phone text, and background extraction changes alpha only. Large edited gallery photos are downscaled to a maximum edge of 2,000 pixels for web delivery; full-resolution originals remain in the cache and source archive.

## Scope and storage

- Read the live catalog into `data/media-processing/plan.json`.
- Deduplicate image URLs. Process primary images as transparent cutouts. Preserve gallery and per-size scenes, removing only the requested website/phone line.
- OCR targets `www.apaniche.vn` and `0961596333`, including spacing variations. A printed `APA NICHE` label alone does not match.
- Clean via a small inpainting mask; extract foreground with U2Net. Already transparent images keep their original alpha.
- Output lossless WebP (sample outputs may be PNG). Upload to a separate `velours/catalog-media-v1/` Cloudinary folder, using content hashes, without overwriting originals.
- Immutable `CatalogSource` records retain original URLs. Back up current image fields before changing MongoDB. Product prices, stock, size assignments, IDs and frame-color logic are untouched.
- Source failures are listed explicitly. Missing photographs cannot be reconstructed without inventing a product photo.

## Run from the repository root

```powershell
python -m venv .venv-media
.\.venv-media\Scripts\python.exe -m pip install -r tools/media/requirements.txt

Push-Location server
node scripts/prepareProductMedia.js
Pop-Location

.\.venv-media\Scripts\python.exe tools/media/bootstrap.py --model
.\.venv-media\Scripts\python.exe tools/media/bootstrap.py
.\.venv-media\Scripts\python.exe tools/media/process_catalog.py --sample --workers 2
# Inspect data/media-processing/samples/processed.jpg before processing all images.
.\.venv-media\Scripts\python.exe tools/media/process_catalog.py --workers 6
# Retry temporary download failures using the cache, without rescanning successes.
.\.venv-media\Scripts\python.exe tools/media/process_catalog.py --retry-errors --workers 2

Push-Location server
node scripts/uploadProductMedia.js
# Preview does not write MongoDB.
node scripts/applyProductMedia.js
node scripts/applyProductMedia.js --apply --database=vouges
Pop-Location

.\.venv-media\Scripts\python.exe tools/media/test_processing.py
```

The uploader also supports `--watch` to overlap storage with processing. Always run one final upload pass after processing completes; this catches revised outputs and interrupted uploads. Apply verifies upload hashes before using URLs. The media migration marker prevents accidental repeat application.

For a staged application, `applyProductMedia.js --avatars-only --apply --database=vouges` publishes the finished avatars first. Once every avatar is ready, resume the remaining images with `process_catalog.py --gallery-only --cpu --workers 4`. Do not rerun the plan generator after applying avatars: keep its original URL mappings. The final application preserves the avatar's cutout role and can substitute a corrected version using the same original asset key.

`node scripts/finishProductMedia.js --worker-pids=<existing-worker-pids>` (from `server`) waits for existing workers, resumes an interrupted scan if needed, retries source failures, checks repeated watermarks, performs the final upload, applies image URLs, and verifies catalog invariants. Omit `--worker-pids` when no initial workers are running. It records each stage in `data/media-processing/finish-status.json`. Run only one coordinator at a time. It withholds the final database update if scanning or uploading fails; original live URLs remain available.

Before final upload, `complete_watermarks.py` independently runs the learned full-image detector on edited photos. Collages receive another pass after detected stamps are removed. A 100-image control sample checks initially unmarked photos; if it reveals missed text, the check expands to every remaining photo. Existing alpha masks are preserved when correcting an avatar. `full-surface-complete.json` records coverage and failures, and the database apply requires this report.

The final check uses two CPU workers with four inference threads each on this machine. GPU OCR was not retained after unexpected system restarts; OCR is CPU-only. Image and result checkpoints flush to disk before atomic replacement. If a restart interrupts older cache writes, `recover_interrupted.py --since <ISO-timestamp>` validates recent outputs and reconstructs damaged records from unchanged originals, retaining approved alpha masks.

Two source galleries show placeholders although their source Open Graph metadata links actual product photographs. After visual verification, `prepare_supplemental.py` records those photos separately in `extra-plan.json` and `extra-results/`. Final apply verifies their upload hashes and fills only still-empty product galleries. Historical source records and the original scan plan stay unchanged.

Before applying, run `node scripts/verifyProductMedia.js --snapshot` from `server`. After applying, run `node scripts/verifyProductMedia.js` to compare all product/order fields other than image fields and update timestamps, and verify source image URLs remain unchanged.

The worker resumes from atomic per-image result files and cached originals. Incomplete cache records and unreadable originals left by an interrupted machine are retained under `.interrupted-*` names and recovered from the source. CPU-only operation is available with `--cpu`. Windows uses DirectML for foreground extraction; OCR runs on CPU because dynamic OCR tensors are unstable on this machine's DirectML driver. OCR native worker pools do not spin while idle. Source requests are limited to ten starts per second per worker process, and HTTP 429/server errors back off.

Runtime models, downloaded images, outputs and per-image upload records are ignored by Git. Keep the workspace cache for resuming or auditing; `applied.json` records the actual outcome and backup path after application.

Technical references: [rembg/U2Net preprocessing](https://github.com/danielgatis/rembg/blob/main/rembg/sessions/u2net.py), [RapidOCR](https://github.com/RapidAI/RapidOCR). Models are downloaded from their published locations and validated against supplied checksums where available.
