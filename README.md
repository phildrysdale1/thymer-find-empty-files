# Thymer Find Empty Files Plugin
Counts words across all records in a collection and creates a summary note listing records with 0 words.

## Installation

1. In Thymer, create a new **Global Plugin**
2. Copy the code from `plugin.js`
3. Paste into the plugin editor
4. Save and enable

## Usage

1. Open command palette (Cmd/Ctrl+K)
2. Run **"Word Count: Analyze Collection"**
3. Select the collection to analyze
4. A summary note is created in your **Notes** collection with:
   - Total word count
   - Total record count
   - Clickable links to each empty record (one per line)

## Requirements

- A "Notes" collection must exist to store the summary

## Example Output

```
Total words in Projects: 12,458
Total records: 47
Empty records: 3

Records with 0 words:
→ Untitled Project
→ Draft Ideas
→ Meeting Notes Template
```
