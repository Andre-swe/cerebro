# OBS Stream Overlay Setup

## Quick Setup

All overlays are in `/Users/stan/Documents/mindcraft-develop/stream/`

### 1. Top Bar (Title Banner)
- **Source Type:** Browser
- **File:** `obs_overlay.html`
- **Width:** 1920
- **Height:** 80
- **Position:** Top of canvas

### 2. Bot Status Panel
- **Source Type:** Browser
- **URL:** `http://localhost:8080/stream/bot_status_panel.html`
- **Width:** 320
- **Height:** 450
- **Position:** Top-right corner (below title bar)

### 3. Relationship Graph
- **Source Type:** Browser
- **URL:** `http://localhost:8080/stream/relationship_graph.html`
- **Width:** 340
- **Height:** 320
- **Position:** Bottom-right corner (above ticker)

### 4. Neural Activity Ticker
- **Source Type:** Browser
- **URL:** `http://localhost:8080/stream/neural_ticker.html`
- **Width:** 1920
- **Height:** 60
- **Position:** Bottom of canvas

## Important Notes

1. **Start Mindserver First** - The overlays connect to `localhost:8080` for live data
2. **Use URL not Local File** - For status panel, graph, and ticker, use the URL method so they can access Socket.io
3. **Top bar can be local** - The title bar doesn't need live data, so local file works

## Recommended Layer Order (bottom to top)

1. Game Capture (Minecraft)
2. Neural Ticker (bottom)
3. Top Bar (top)
4. Bot Status Panel (right side)
5. Relationship Graph (bottom right)

## Serving the Overlays

Add this to mindserver.js to serve the stream folder (or it may already be served):

```javascript
app.use('/stream', express.static(path.join(__dirname, 'public/../../../stream')));
```

Or copy the stream folder into `src/mindcraft/public/stream/`

## Color Scheme

- Primary: `#ff6b35` (Orange)
- Background: `rgba(0, 0, 0, 0.9)`
- Marco: `#ff6b35`
- Claude: `#4a9eff`
- Jules: `#50c878`
