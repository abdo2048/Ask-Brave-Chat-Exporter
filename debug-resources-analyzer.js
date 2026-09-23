// Ask Brave Resources & Citations Deep Analyzer
// Install this as a temporary userscript or run in Console (F12) on an Ask Brave conversation page
// This script extracts ALL resource/citation data from the DOM and API responses

(function() {
    console.clear();
    console.log("%c🔍 Ask Brave Resources & Citations Deep Analyzer", "font-size: 20px; font-weight: bold; color: #0078D4;");
    console.log("Starting analysis... Please wait while I scan the page.\n");

    const results = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        totalMessages: 0,
        totalResourcesFound: 0,
        resourcesByType: {},
        resourcesByLocation: {},
        duplicateResources: [],
        unrelatedResources: [],
        allResources: [],
        messageAnalysis: []
    };

    // Helper: Extract domain from URL
    function getDomain(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch { return 'unknown'; }
    }

    // Helper: Categorize resource type
    function categorizeResource(url, title, snippet) {
        const lowerTitle = (title || '').toLowerCase();
        const lowerSnippet = (snippet || '').toLowerCase();
        const lowerUrl = (url || '').toLowerCase();

        if (lowerUrl.includes('wikipedia.org')) return 'Encyclopedia';
        if (lowerUrl.includes('reddit.com')) return 'Forum/Discussion';
        if (lowerUrl.includes('github.com')) return 'Code Repository';
        if (lowerUrl.includes('youtube.com') || lowerUrl.includes('vimeo.com')) return 'Video';
        if (lowerUrl.includes('/blog/') || lowerUrl.includes('medium.com')) return 'Blog';
        if (lowerUrl.includes('news') || lowerUrl.includes('cnn') || lowerUrl.includes('bbc')) return 'News';
        if (lowerUrl.endsWith('.pdf')) return 'Document (PDF)';
        if (lowerTitle.includes('documentation') || lowerTitle.includes('docs')) return 'Documentation';
        if (lowerTitle.includes('tutorial') || lowerTitle.includes('how-to')) return 'Tutorial';
        if (lowerSnippet.includes('buy') || lowerSnippet.includes('price') || lowerUrl.includes('shop')) return 'Commercial';
        
        return 'General Web Page';
    }

    // 1. Scan DOM for Resource Sections
    console.groupCollapsed("📂 Step 1: Scanning DOM for Resource Containers");
    
    // Selectors based on common Brave patterns (may need adjustment)
    const resourceSelectors = [
        '[class*="resource"]',
        '[class*="citation"]',
        '[class*="reference"]',
        '[class*="source"]',
        '[data-type="resource"]',
        '[data-type="citation"]',
        'article[class*="card"]', // Common card pattern
        'div[class*="footer"] div[class*="list"]', // Footer lists
        'ol[class*="list"]', // Ordered lists often used for citations
        'ul[class*="list"]'  // Unordered lists
    ];

    const resourceContainers = [];
    resourceSelectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                resourceContainers.push(...Array.from(elements));
            }
        } catch (e) {}
    });

    // Deduplicate containers by reference
    const uniqueContainers = [...new Set(resourceContainers)];
    console.log(`Found ${uniqueContainers.length} potential resource containers.`);

    uniqueContainers.forEach((container, index) => {
        const location = container.tagName.toLowerCase() + (container.className ? '.' + container.className.split(' ').filter(c=>c).join('.') : '');
        const links = container.querySelectorAll('a[href]');
        
        if (links.length > 0) {
            results.resourcesByLocation[location] = (results.resourcesByLocation[location] || 0) + links.length;
            
            links.forEach(link => {
                const href = link.href;
                const title = link.title || link.textContent?.trim() || 'No Title';
                const parentText = container.parentElement?.innerText?.substring(0, 100) || '';
                
                const resourceObj = {
                    id: `dom-${index}-${href}`,
                    url: href,
                    title: title,
                    domain: getDomain(href),
                    type: categorizeResource(href, title, parentText),
                    locationInDOM: location,
                    context: parentText,
                    source: 'DOM Scraping'
                };
                
                results.allResources.push(resourceObj);
                results.totalResourcesFound++;
                
                // Track types
                results.resourcesByType[resourceObj.type] = (results.resourcesByType[resourceObj.type] || 0) + 1;
            });
        }
    });
    console.groupEnd();

    // 2. Scan Individual Messages for Inline Citations
    console.groupCollapsed("💬 Step 2: Scanning Message Bubbles for Inline Citations");
    
    // Heuristic: Look for message bubbles. Brave usually uses specific classes.
    // We look for paragraphs containing numbered brackets like [1], [2] or superscript numbers
    const messageSelectors = [
        '[class*="message"]',
        '[class*="bubble"]',
        '[class*="response"]',
        '[class*="answer"]',
        'article', 
        'div[class*="content"]'
    ];

    let messageCount = 0;
    const seenUrls = new Map(); // Track duplicates

    messageSelectors.forEach(selector => {
        const messages = document.querySelectorAll(selector);
        messages.forEach(msg => {
            // Filter out non-AI messages if possible (heuristic: contains citation markers)
            const text = msg.innerText;
            if (!text || text.length < 50) return; // Skip tiny fragments

            // Look for citation patterns: [1], [2], or links inside the message
            const inlineLinks = msg.querySelectorAll('a[href]');
            const citationMarkers = text.match(/\[\d+\]/g) || [];
            
            if (inlineLinks.length > 0 || citationMarkers.length > 0) {
                messageCount++;
                const msgData = {
                    messageId: `msg-${messageCount}`,
                    textPreview: text.substring(0, 150) + (text.length > 150 ? '...' : ''),
                    citationCount: citationMarkers.length,
                    linkCount: inlineLinks.length,
                    resources: []
                };

                inlineLinks.forEach(link => {
                    const href = link.href;
                    const title = link.textContent?.trim() || 'Link';
                    
                    // Check for duplicates globally
                    if (seenUrls.has(href)) {
                        results.duplicateResources.push({
                            url: href,
                            occurrences: seenUrls.get(href).occurrences + 1,
                            locations: [...seenUrls.get(href).locations, `Message ${messageCount}`]
                        });
                        seenUrls.get(href).occurrences++;
                    } else {
                        seenUrls.set(href, { occurrences: 1, locations: [`Message ${messageCount}`] });
                        
                        const resObj = {
                            id: `inline-${href}`,
                            url: href,
                            title: title,
                            domain: getDomain(href),
                            type: categorizeResource(href, title, text),
                            locationInDOM: 'Inline within AI Response',
                            context: text.substring(0, 100),
                            source: 'Inline Citation'
                        };
                        results.allResources.push(resObj);
                        msgData.resources.push(resObj);
                    }
                });

                results.messageAnalysis.push(msgData);
            }
        });
    });
    results.totalMessages = messageCount;
    console.log(`Analyzed ${messageCount} messages with potential citations.`);
    console.groupEnd();

    // 3. Analyze "Resources" Footer Section (Specific Brave Pattern)
    console.groupCollapsed("📚 Step 3: Scanning Dedicated 'Sources' / 'Resources' Footer");
    
    // Try to find the specific footer section often labeled "Sources" or "Learn more"
    const footerKeywords = ['sources', 'resources', 'references', 'learn more', 'explore'];
    const allElements = document.querySelectorAll('*');
    
    allElements.forEach(el => {
        const text = el.innerText?.toLowerCase() || '';
        const isFooterHeader = footerKeywords.some(k => text.includes(k) && text.length < 50);
        
        if (isFooterHeader && el.children.length > 0) {
            const links = el.parentElement?.querySelectorAll('a[href]') || el.querySelectorAll('a[href]');
            if (links.length > 0) {
                console.log(`Found dedicated resource section: "${el.innerText.trim()}"`);
                links.forEach(link => {
                    // Avoid re-adding if already caught by DOM scan (simple check)
                    const exists = results.allResources.some(r => r.url === link.href);
                    if (!exists) {
                        const resObj = {
                            id: `footer-${link.href}`,
                            url: link.href,
                            title: link.title || link.innerText,
                            domain: getDomain(link.href),
                            type: categorizeResource(link.href, link.title, ''),
                            locationInDOM: 'Dedicated Footer Section',
                            context: el.innerText.trim(),
                            source: 'Footer Section'
                        };
                        results.allResources.push(resObj);
                        results.resourcesByType[resObj.type] = (results.resourcesByType[resObj.type] || 0) + 1;
                    }
                });
            }
        }
    });
    console.groupEnd();

    // 4. Post-Processing & Analysis
    console.groupCollapsed("🧠 Step 4: Generating Analysis Report");

    // Identify potential unrelated resources (Heuristic: Domain mismatch or generic titles)
    // This is hard to do perfectly without topic analysis, but we can flag low-confidence ones
    const genericTitles = ['click here', 'read more', 'source', 'link', 'website'];
    results.allResources.forEach(res => {
        const lowerTitle = res.title.toLowerCase();
        if (genericTitles.some(t => lowerTitle === t) || res.title === 'No Title') {
            results.unrelatedResources.push({
                reason: 'Generic or missing title',
                resource: res
            });
        }
    });

    // Summary Stats
    const summary = {
        totalUniqueResources: results.allResources.length,
        totalDuplicatesDetected: results.duplicateResources.length,
        resourceTypesBreakdown: results.resourcesByType,
        locationsBreakdown: results.resourcesByLocation,
        messagesWithCitations: results.messageAnalysis.length,
        potentialUnrelatedCount: results.unrelatedResources.length
    };

    console.log("\n%c📊 ANALYSIS SUMMARY:", "font-size: 16px; font-weight: bold; color: #28a745;");
    console.table(summary);

    console.log("\n%c🗂️ RESOURCE TYPES FOUND:", "font-size: 14px; font-weight: bold; color: #17a2b8;");
    console.table(results.resourcesByType);

    if (results.duplicateResources.length > 0) {
        console.log("\n%c⚠️ DUPLICATE RESOURCES DETECTED:", "font-size: 14px; font-weight: bold; color: #ffc107;");
        console.table(results.duplicateResources.slice(0, 10)); // Show top 10
        if (results.duplicateResources.length > 10) console.log(`...and ${results.duplicateResources.length - 10} more.`);
    }

    if (results.unrelatedResources.length > 0) {
        console.log("\n%c❓ POTENTIALLY UNRELATED/LOW QUALITY RESOURCES:", "font-size: 14px; font-weight: bold; color: #dc3545;");
        console.table(results.unrelatedResources.slice(0, 10));
    }

    console.log("\n%c💾 FULL DATA OBJECT:", "font-size: 14px; font-weight: bold; color: #6f42c1;");
    console.log("Copy the 'results' variable from the console or run: copy(results) to clipboard");
    
    // Expose to window for easy copying
    window.askBraveResourceAnalysis = results;
    
    console.groupEnd();

    console.log("%c✅ Analysis Complete. Type 'askBraveResourceAnalysis' in console to inspect the full JSON object.", "color: green; font-weight: bold;");

})();
