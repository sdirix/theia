# Potential Future Work for AI Chat Persistence

This document contains ideas and tasks that were considered for the chat persistence feature but are not part of the initial implementation. These can be considered for future enhancements.

---

## Empty State UI (Alternative to Show Chats Integration)

### Task: Create History Data Provider

**File**: `packages/ai-chat-ui/src/browser/chat-history-provider.ts`

Create a service to provide historical sessions:

```typescript
@injectable()
export class ChatHistoryProvider {
    @inject(ChatService)
    protected readonly chatService: ChatService;

    @inject(ChatSessionStore)
    protected readonly sessionStore: ChatSessionStore;

    private readonly onDidChangeEmitter = new Emitter<void>();
    readonly onDidChange = this.onDidChangeEmitter.event;

    async getHistoricalSessions(): Promise<ChatHistoryItem[]> {
        const index = await this.sessionStore.getSessionIndex();
        return Object.values(index)
            .filter(item => !item.isEmpty)
            .sort((a, b) => b.lastMessageDate - a.lastMessageDate)
            .map(item => ({
                sessionId: item.sessionId,
                title: item.title || 'New Chat',
                date: new Date(item.lastMessageDate),
                preview: '', // Could load first message
            }));
    }
}
```

---

### Task: Create Empty State Component

**File**: `packages/ai-chat-ui/src/browser/chat-empty-state-widget.tsx`

Create a React component to show when no active session:

```tsx
export const ChatEmptyStateWidget: React.FC<{
    history: ChatHistoryItem[];
    onSelectSession: (sessionId: string) => void;
    onNewSession: () => void;
}> = ({ history, onSelectSession, onNewSession }) => {
    return (
        <div className="chat-empty-state">
            <div className="chat-empty-header">
                <h2>AI Chat</h2>
                <button onClick={onNewSession}>New Chat</button>
            </div>

            {history.length > 0 && (
                <div className="chat-history-list">
                    <h3>Recent Conversations</h3>
                    {history.map(item => (
                        <div
                            key={item.sessionId}
                            className="chat-history-item"
                            onClick={() => onSelectSession(item.sessionId)}
                        >
                            <div className="history-title">{item.title}</div>
                            <div className="history-date">{formatDate(item.date)}</div>
                        </div>
                    ))}
                </div>
            )}

            {history.length === 0 && (
                <div className="chat-empty-message">
                    No previous conversations
                </div>
            )}
        </div>
    );
};
```

---

### Task: Integrate Empty State into ChatViewWidget

**File**: `packages/ai-chat-ui/src/browser/chat-view-widget.tsx` (extend)

Update `ChatViewWidget` to show empty state:

```typescript
export class ChatViewWidget extends BaseWidget {
    @inject(ChatHistoryProvider)
    protected readonly historyProvider: ChatHistoryProvider;

    protected emptyStateWidget?: ChatEmptyStateWidget;

    @postConstruct()
    protected init(): void {
        // ... existing init

        // Listen for session changes
        this.chatService.onSessionEvent(event => {
            if (isActiveSessionChangedEvent(event)) {
                this.updateView();
            }
        });

        this.updateView();
    }

    private async updateView(): Promise<void> {
        const hasActiveSession = this.chatSession &&
                                 !this.chatSession.model.isEmpty();

        if (!hasActiveSession) {
            await this.showEmptyState();
        } else {
            this.showChatUI();
        }
    }

    private async showEmptyState(): Promise<void> {
        // Hide chat tree and input
        this.treeWidget.hide();
        this.inputWidget.hide();

        // Show empty state with history
        const history = await this.historyProvider.getHistoricalSessions();
        // Render empty state
    }

    private showChatUI(): void {
        // Hide empty state
        // Show tree and input
        this.treeWidget.show();
        this.inputWidget.show();
    }
}
```

---

### Task: Add History Styling

**File**: `packages/ai-chat-ui/src/browser/style/chat-history.css`

Create styles for the history UI:

```css
.chat-empty-state {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 20px;
}

.chat-empty-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 30px;
}

.chat-history-list {
    overflow-y: auto;
}

.chat-history-item {
    padding: 12px;
    border: 1px solid var(--theia-dropdown-border);
    border-radius: 4px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
}

.chat-history-item:hover {
    background-color: var(--theia-list-hoverBackground);
}

.history-title {
    font-weight: 600;
    margin-bottom: 4px;
}

.history-date {
    font-size: 0.85em;
    color: var(--theia-descriptionForeground);
}
```

---

## Session Management Commands

### Task: Add Restore Session Command

**File**: `packages/ai-chat/src/browser/ai-chat-frontend-contribution.ts`

Add command to restore a specific session:

```typescript
export namespace ChatCommands {
    export const RESTORE_SESSION: Command = {
        id: 'ai-chat.restoreSession',
        label: 'Restore Chat Session',
    };
}

@injectable()
export class AIChatFrontendContribution implements CommandContribution {
    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(ChatCommands.RESTORE_SESSION, {
            execute: async (sessionId: string) => {
                const model = await this.chatService.getOrRestoreSession(sessionId);
                if (model) {
                    await this.chatService.setActiveSession(sessionId);
                    // Open chat view
                    await this.widgetManager.getOrCreateWidget(ChatViewWidget.ID);
                }
            }
        });
    }
}
```

---

### Task: Add Delete Session Command

**File**: `packages/ai-chat/src/browser/ai-chat-frontend-contribution.ts` (extend)

```typescript
export namespace ChatCommands {
    export const DELETE_SESSION: Command = {
        id: 'ai-chat.deleteSession',
        label: 'Delete Chat Session',
    };
}

// In registerCommands:
commands.registerCommand(ChatCommands.DELETE_SESSION, {
    execute: async (sessionId: string) => {
        const confirmed = await this.messageService.confirm(
            'Delete this chat session permanently?'
        );
        if (confirmed) {
            await this.sessionStore.deleteSession(sessionId);
            // If it's the active session, create new one
            if (this.chatService.getActiveSession()?.id === sessionId) {
                this.chatService.createSession();
            }
        }
    }
});
```

---

### Task: Add Rename Session Command

**File**: `packages/ai-chat/src/browser/ai-chat-frontend-contribution.ts` (extend)

```typescript
export namespace ChatCommands {
    export const RENAME_SESSION: Command = {
        id: 'ai-chat.renameSession',
        label: 'Rename Chat Session',
    };
}

commands.registerCommand(ChatCommands.RENAME_SESSION, {
    execute: async (sessionId: string) => {
        const currentTitle = await this.getSessionTitle(sessionId);
        const newTitle = await this.quickInputService.input({
            prompt: 'Enter new session title',
            value: currentTitle,
        });

        if (newTitle) {
            await this.chatService.setChatSessionTitle(sessionId, newTitle);
        }
    }
});
```

---

### Task: Add Context Menu for History Items

**File**: `packages/ai-chat-ui/src/browser/chat-empty-state-widget.tsx` (extend)

Add context menu to history items:

```tsx
const ChatHistoryItem: React.FC<{
    item: ChatHistoryItem;
    onSelect: () => void;
    onRename: () => void;
    onDelete: () => void;
}> = ({ item, onSelect, onRename, onDelete }) => {
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        // Show context menu with Rename, Delete options
    };

    return (
        <div
            className="chat-history-item"
            onClick={onSelect}
            onContextMenu={handleContextMenu}
        >
            {/* ... */}
        </div>
    );
};
```

---

## Testing & Polish

### Task: Create Integration Test Suite

**File**: `packages/ai-chat/src/browser/test/chat-persistence.spec.ts`

Create comprehensive integration tests:

```typescript
describe('Chat Persistence', () => {
    it('should persist and restore simple session', async () => {
        // Create session, send request, get response
        // Save session
        // Clear memory
        // Restore session
        // Verify all data intact
    });

    it('should persist session with code blocks', async () => {
        // Test code content serialization
    });

    it('should handle missing deserializers gracefully', async () => {
        // Test unknown content type handling
    });

    it('should persist session hierarchy with branches', async () => {
        // Test request branching
    });

    it('should restore context variables', async () => {
        // Test variable restoration
    });
});
```

---

### Task: Add Telemetry/Logging

**File**: `packages/ai-chat/src/common/chat-service.ts` (extend)

Add logging for persistence operations:

```typescript
export class ChatServiceImpl {
    async saveSession(sessionId: string): Promise<void> {
        const startTime = Date.now();
        try {
            this.logger.debug(`Saving chat session ${sessionId}...`);
            const session = this._sessions.find(s => s.id === sessionId);
            if (session) {
                await this.sessionStore.storeSessions([session.model]);
                this.logger.info(`Saved session ${sessionId} in ${Date.now() - startTime}ms`);
            }
        } catch (error) {
            this.logger.error(`Failed to save chat session ${sessionId}:`, error);
        }
    }
}
```

---

### Task: Performance Optimization

**File**: `packages/ai-chat/src/browser/chat-session-store-impl.ts` (optimize)

Optimize storage operations:

- Implement write queuing to prevent concurrent writes (already in plan)
- Add LRU cache for session metadata
- Lazy-load session content (only load when opened)
- Use Web Workers for JSON serialization of large sessions

```typescript
export class ChatSessionStoreImpl {
    private readonly metadataCache = new LRU<string, ChatSessionMetadata>(100);

    async getSessionIndex(): Promise<ChatSessionIndex> {
        // Check cache first
        if (this.indexCache) {
            return this.indexCache;
        }

        // Load from storage and cache
        const index = await this.loadIndexFromStorage();
        this.indexCache = index;
        return index;
    }
}
```

---

### Task: Add User Preferences

**File**: `packages/ai-chat/src/common/ai-chat-preferences.ts` (extend)

Add preferences for persistence behavior:

```typescript
export const AI_CHAT_PREFERENCES_SCHEMA: PreferenceSchema = {
    properties: {
        'ai.chat.persistence.enabled': {
            type: 'boolean',
            default: true,
            description: 'Enable automatic persistence of chat sessions'
        },
        'ai.chat.persistence.maxSessions': {
            type: 'number',
            default: 25,
            description: 'Maximum number of chat sessions to keep in history'
        },
        'ai.chat.persistence.autoSaveDelay': {
            type: 'number',
            default: 0, // Save immediately after response
            description: 'Delay in milliseconds before auto-saving session changes (0 = immediate)'
        }
    }
};
```

---

## Migration & Backward Compatibility

### Task: Detect Existing Session Data

**File**: `packages/ai-chat/src/browser/chat-session-migration.ts`

Create migration service:

```typescript
@injectable()
export class ChatSessionMigrationService {
    async checkForLegacyData(): Promise<boolean> {
        // Check if any legacy session data exists
        // Return true if migration needed
    }

    async migrateLegacySessions(): Promise<void> {
        // Convert old format to new format
        // Update storage locations
        // Clean up old data
    }
}
```

---

### Task: Add Version Checking

**File**: `packages/ai-chat/src/browser/chat-session-store-impl.ts` (extend)

Implement actual version checking:

```typescript
private async migrateDataIfNeeded(): Promise<void> {
    const index = await this.getSessionIndex();

    // Check version and migrate if needed
    if (index.version !== CHAT_DATA_VERSION) {
        this.logger.info(`Migrating chat sessions from v${index.version} to v${CHAT_DATA_VERSION}`);
        await this.migrationService.migrate(index.version, CHAT_DATA_VERSION);
    }
}
```

---

## Documentation & Examples

### Task: Update Package README

**File**: `packages/ai-chat/README.md`

Document the persistence feature:

````markdown
# Chat Session Persistence

Chat sessions are automatically saved and can be restored from the history.

## Features

- Automatic persistence of all chat sessions
- History view showing past conversations (via "Show Chats..." command)
- Session restoration with full context
- Customizable persistence behavior via preferences

## Architecture

Sessions are stored as JSON files in the workspace storage directory. Each session includes:
- All requests and responses
- Session metadata (title, timestamp, location)
- Context variables (where serializable)
- Request hierarchy and branches

## For Developers

### Custom Content Serialization

If you create a custom `ChatResponseContent` type, implement the `serialize()` method and provide a deserializer:

```typescript
// In your content implementation:
export class MyCustomContentImpl implements ChatResponseContent {
    kind = 'myCustom';

    serialize(): unknown {
        return {
            // Return JSON-serializable data
            data: this.data,
            timestamp: this.timestamp
        };
    }
}

// Create a deserializer contribution:
@injectable()
export class MyContentDeserializerContribution implements ChatContentDeserializerContribution {
    registerDeserializers(registry: ChatContentDeserializerRegistry): void {
        registry.register({
            kind: 'myCustom',
            deserialize: (data: any) => new MyCustomContentImpl(data.data, data.timestamp)
        });
    }
}
```

Then bind the contribution in your module:
```typescript
bind(ChatContentDeserializerContribution).to(MyContentDeserializerContribution);
```

### Storage Location

Sessions are stored in:
- Workspace mode: `<workspace>/.theia/chatSessions/`
- User mode: `<userData>/chatSessions/`
````

---

### Task: Create Example Extension

**File**: `examples/ai-chat-custom-serializer/`

Create an example showing custom content serialization:

```typescript
// Example custom content type with serialization
class CustomChartContent implements ChatResponseContent {
    kind = 'chart';

    constructor(public chartData: ChartData) {}

    serialize(): unknown {
        return this.chartData;
    }
}

// Example deserializer
@injectable()
class ChartDeserializerContribution implements ChatContentDeserializerContribution {
    registerDeserializers(registry: ChatContentDeserializerRegistry): void {
        registry.register({
            kind: 'chart',
            deserialize: (data: ChartData) => new CustomChartContent(data)
        });
    }
}
```

---

## Summary

These tasks represent potential enhancements that could be added after the initial persistence implementation is complete. They are organized by category:

1. **Empty State UI**: Alternative approach to showing history (instead of "Show Chats...")
2. **Session Management**: Commands for delete, rename, etc.
3. **Testing & Polish**: Comprehensive tests, logging, performance, preferences
4. **Migration**: Future-proofing for schema changes
5. **Documentation**: README updates and examples

These can be prioritized based on user feedback and needs after the core persistence functionality is working.
