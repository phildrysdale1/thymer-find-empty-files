/**
 * Word Count Plugin for Thymer
 * 
 * Counts words in all records of a chosen collection and creates a note
 * in your Notes collection listing all records with 0 words, with links.
 */
class Plugin extends AppPlugin {
    
    onLoad() {
        this.ui.addCommandPaletteCommand({
            label: "Word Count: Analyze Collection",
            icon: "ti-file-text",
            onSelected: async () => {
                await this.analyzeCollection();
            }
        });
    }

    async analyzeCollection() {
        // Get all collections
        const allCollections = await this.data.getAllCollections();
        
        // Filter out system collections
        const userCollections = allCollections.filter(c => {
            const name = c.getName();
            return name !== 'Sync Hub' && name !== 'Agent Hub';
        });

        if (userCollections.length === 0) {
            this.ui.addToaster({
                title: "No collections found",
                dismissible: true,
                autoDestroyTime: 3000
            });
            return;
        }

        // Show collection picker
        const collectionNames = userCollections.map(c => ({ 
            name: c.getName(), 
            collection: c 
        }));
        
        const selected = await this.showCollectionPicker(collectionNames);
        
        if (!selected) return;
        
        this.ui.addToaster({
            title: "Analyzing records...",
            dismissible: true,
            autoDestroyTime: 2000
        });
        
        // Analyze the collection
        const result = await this.countWords(selected);
        
        // Create summary note in Notes collection
        await this.createSummaryNote(selected.getName(), result);
    }

    async showCollectionPicker(collections) {
        return new Promise((resolve) => {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;

            // Create dialog
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: var(--background-primary);
                border-radius: 8px;
                padding: 24px;
                max-width: 400px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            `;

            dialog.innerHTML = `
                <h2 style="margin: 0 0 16px 0; color: var(--text-normal);">Select Collection</h2>
                <div id="collection-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
                <div style="margin-top: 16px; text-align: right;">
                    <button id="cancel-btn" style="padding: 8px 16px; border: 1px solid var(--background-modifier-border); background: var(--background-primary); color: var(--text-normal); border-radius: 4px; cursor: pointer;">Cancel</button>
                </div>
            `;

            const listContainer = dialog.querySelector('#collection-list');
            
            // Add collection buttons
            for (const { name, collection } of collections) {
                const button = document.createElement('button');
                button.textContent = name;
                button.style.cssText = `
                    padding: 12px;
                    text-align: left;
                    width: 100%;
                    background: var(--background-secondary);
                    border: 1px solid var(--background-modifier-border);
                    border-radius: 4px;
                    color: var(--text-normal);
                    cursor: pointer;
                    transition: background 0.2s;
                `;
                button.onmouseenter = () => {
                    button.style.background = 'var(--background-modifier-hover)';
                };
                button.onmouseleave = () => {
                    button.style.background = 'var(--background-secondary)';
                };
                button.onclick = () => {
                    document.body.removeChild(overlay);
                    resolve(collection);
                };
                listContainer.appendChild(button);
            }

            dialog.querySelector('#cancel-btn').onclick = () => {
                document.body.removeChild(overlay);
                resolve(null);
            };

            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                    resolve(null);
                }
            };

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
        });
    }

    async countWords(collection) {
        const records = await collection.getAllRecords();
        const emptyRecords = [];
        let totalWords = 0;
        let totalRecords = 0;

        for (const record of records) {
            const lineItems = await record.getLineItems();
            const wordCount = this.countWordsInLineItems(lineItems);
            
            totalWords += wordCount;
            totalRecords++;

            if (wordCount === 0) {
                emptyRecords.push({
                    guid: record.guid,
                    title: record.getName() || 'Untitled'
                });
            }
        }

        return {
            totalWords,
            totalRecords,
            emptyRecords
        };
    }

    countWordsInLineItems(lineItems) {
        let text = '';

        for (const item of lineItems) {
            if (!item.segments) continue;

            for (const segment of item.segments) {
                if (segment.type === 'text' && segment.text) {
                    text += segment.text + ' ';
                }
            }
        }

        // Count words
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);
        return words.length;
    }

    async createSummaryNote(collectionName, result) {
        // Find Notes collection
        const allCollections = await this.data.getAllCollections();
        let notesCollection = allCollections.find(c => 
            c.getName().toLowerCase() === 'notes'
        );

        if (!notesCollection) {
            this.ui.addToaster({
                title: "Notes collection not found",
                message: "Please create a 'Notes' collection first.",
                dismissible: true,
                autoDestroyTime: 4000
            });
            return;
        }

        // Create the record
        const timestamp = new Date().toLocaleString();
        const title = `Word Count - ${collectionName} - ${timestamp}`;
        
        const recordGuid = notesCollection.createRecord(title);
        if (!recordGuid) {
            this.ui.addToaster({
                title: "Failed to create record",
                dismissible: true,
                autoDestroyTime: 3000
            });
            return;
        }

        // Wait for record to sync
        await new Promise(resolve => setTimeout(resolve, 50));
        const records = await notesCollection.getAllRecords();
        const record = records.find(r => r.guid === recordGuid);

        if (!record) {
            this.ui.addToaster({
                title: "Failed to find created record",
                dismissible: true,
                autoDestroyTime: 3000
            });
            return;
        }

        // Build content
        const segments = [];
        
        // Summary stats
        segments.push([
            { type: 'text', text: `Total words in ${collectionName}: ` },
            { type: 'bold', text: result.totalWords.toString() }
        ]);

        segments.push([
            { type: 'text', text: `Total records: ` },
            { type: 'bold', text: result.totalRecords.toString() }
        ]);

        segments.push([
            { type: 'text', text: `Empty records: ` },
            { type: 'bold', text: result.emptyRecords.length.toString() }
        ]);

        // Add blank line
        segments.push([]);

        // Heading
        if (result.emptyRecords.length > 0) {
            segments.push([
                { type: 'text', text: 'Records with 0 words:' }
            ]);

            // Add each empty record as a link
            for (const empty of result.emptyRecords) {
                segments.push([
                    { type: 'ref', text: { guid: empty.guid } }
                ]);
            }
        } else {
            segments.push([
                { type: 'text', text: 'All records have content! 🎉' }
            ]);
        }

        // Insert all line items
        let lastItem = null;
        for (const segmentArray of segments) {
            const item = await record.createLineItem(null, lastItem, 'text');
            if (item) {
                await item.setSegments(segmentArray);
                lastItem = item;
            }
        }

        this.ui.addToaster({
            title: "Word Count Complete",
            message: `Summary note created with ${result.emptyRecords.length} empty records`,
            dismissible: true,
            autoDestroyTime: 3000
        });
    }
}
