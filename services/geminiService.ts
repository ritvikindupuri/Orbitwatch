import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// Initialize Gemini with the platform-provided API key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

/**
 * MCP Tool: Search Satellite Catalog
 */
const searchSatelliteCatalogTool = {
    name: "search_satellite_catalog",
    parameters: {
        type: Type.OBJECT,
        description: "Search the global satellite catalog for specific assets using name, NORAD ID, or owner.",
        properties: {
            query: { type: Type.STRING, description: "The search term (e.g., 'STARLINK', '25544', 'USA')." },
            limit: { type: Type.NUMBER, description: "Maximum number of results to return (default 10)." }
        },
        required: ["query"]
    }
};

/**
 * MCP Tool: Search Intelligence Ledger
 */
const searchIntelligenceLedgerTool = {
    name: "search_intelligence_ledger",
    parameters: {
        type: Type.OBJECT,
        description: "Search the mission intelligence ledger for forensic events, anomalies, or pattern detections.",
        properties: {
            missionId: { type: Type.STRING, description: "Filter by a specific mission ID." },
            type: { type: Type.STRING, description: "Filter by event type (e.g., ANOMALY, MANEUVER, PATTERN_MATCH)." },
            query: { type: Type.STRING, description: "General search query for event descriptions." }
        }
    }
};

/**
 * MCP Tool: Search Tactical SOPs
 */
const searchTacticalSOPsTool = {
    name: "search_tactical_sops",
    parameters: {
        type: Type.OBJECT,
        description: "Search the tactical Standard Operating Procedures (SOP) knowledge base for mission-specific guidance and rules of engagement.",
        properties: {
            query: { type: Type.STRING, description: "The search term (e.g., 'RPO safety distance', 'EW response protocol')." },
            category: { type: Type.STRING, description: "Optional category filter: RPO, EW, KINETIC, GENERAL." }
        },
        required: ["query"]
    }
};

/**
 * Implementation of the search tools that talk to the local Elasticsearch relay
 */
const toolImplementations = {
    search_satellite_catalog: async (args: { query: string; limit?: number }) => {
        const esQuery = {
            query: {
                multi_match: {
                    query: args.query,
                    fields: ["OBJECT_NAME", "NORAD_CAT_ID", "OWNER", "ORGANIZATION"]
                }
            },
            size: args.limit || 10
        };

        const response = await fetch('/v1/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: 'satellite-catalog', query: esQuery })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 401) {
                throw new Error("Invalid connection credentials. Please update them in the Settings menu.");
            }
            throw new Error(errorData.message || errorData.error?.reason || "Catalog search failed");
        }
        const data = await response.json();
        return data.hits.hits.map((h: any) => h._source);
    },

    search_intelligence_ledger: async (args: { missionId?: string; type?: string; query?: string }) => {
        const must: any[] = [];
        if (args.missionId) must.push({ term: { missionId: args.missionId } });
        if (args.type) must.push({ term: { type: args.type } });
        if (args.query) must.push({ multi_match: { query: args.query, fields: ["description", "forensics"] } });

        const esQuery = {
            query: must.length > 0 ? { bool: { must } } : { match_all: {} },
            size: 20,
            sort: [{ processedAt: "desc" }]
        };

        const response = await fetch('/v1/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: 'sda-intelligence-ledger', query: esQuery })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 401) {
                throw new Error("Invalid connection credentials. Please update them in the Settings menu.");
            }
            throw new Error(errorData.message || errorData.error?.reason || "Ledger search failed");
        }
        const data = await response.json();
        return data.hits.hits.map((h: any) => h._source);
    },

    search_tactical_sops: async (args: { query: string; category?: string }) => {
        const must: any[] = [];
        if (args.category) must.push({ term: { category: args.category } });
        must.push({ multi_match: { query: args.query, fields: ["title", "content"] } });

        const esQuery = {
            query: { bool: { must } },
            size: 10
        };

        const response = await fetch('/v1/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: 'tactical-sops', query: esQuery })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 401) {
                throw new Error("Invalid connection credentials. Please update them in the Settings menu.");
            }
            throw new Error(errorData.message || errorData.error?.reason || "SOP search failed");
        }
        const data = await response.json();
        return data.hits.hits.map((h: any) => h._source);
    }
};

const SYSTEM_INSTRUCTION = `You are the OrbitWatch Assistant, an AI helping operators search satellite catalogs, mission history, and tactical SOPs.
Your goal is to help operators find specific assets, review mission events, and provide guidance based on official Standard Operating Procedures.

When a user asks about a satellite, use 'search_satellite_catalog'.
When a user asks about mission events, anomalies, or history, use 'search_intelligence_ledger'.
When a user asks for guidance, rules of engagement, or safety protocols, use 'search_tactical_sops'.

Always provide concise, technical summaries. If data is found, highlight NORAD IDs, risk levels, or specific SOP sections.
If the search fails due to invalid credentials, inform the user they need to update their connection settings in the Settings menu.`;

/**
 * Chat Session Manager
 */
export class IntelligenceChatSession {
    private history: any[] = [];

    async sendMessage(message: string): Promise<string> {
        this.history.push({ role: 'user', parts: [{ text: message }] });

        let response = await ai.models.generateContent({
            model: "gemini-3.1-pro-preview",
            contents: this.history,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                tools: [{ functionDeclarations: [searchSatelliteCatalogTool, searchIntelligenceLedgerTool, searchTacticalSOPsTool] }]
            }
        });
        
        // Handle function calls (MCP bridge)
        let functionCalls = response.functionCalls;
        
        // We support one level of tool calling for now, which is usually enough for search tasks
        if (functionCalls) {
            const toolResults = [];
            for (const call of functionCalls) {
                const { name, args } = call;
                console.log(`[MCP] Executing ${name} with args:`, args);
                
                try {
                    const result = await (toolImplementations as any)[name](args);
                    toolResults.push({
                        functionResponse: {
                            name,
                            response: { content: result }
                        }
                    });
                } catch (e: any) {
                    console.error(`[MCP] Tool execution failed: ${name}`, e);
                    toolResults.push({
                        functionResponse: {
                            name,
                            response: { error: e.message }
                        }
                    });
                }
            }

            // Add the model's tool call to history
            this.history.push(response.candidates[0].content);

            // Add the tool results to history
            this.history.push({
                role: 'user', 
                parts: toolResults
            });

            // Get final response from the model based on tool results
            response = await ai.models.generateContent({
                model: "gemini-3.1-pro-preview",
                contents: this.history,
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION,
                    tools: [{ functionDeclarations: [searchSatelliteCatalogTool, searchIntelligenceLedgerTool] }]
                }
            });
        }

        this.history.push(response.candidates[0].content);
        return response.text || "I processed the request but couldn't generate a clear summary. Please check the mission logs.";
    }
}
