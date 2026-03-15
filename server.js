const express = require('express');
const { execFile } = require('child_process');
const cors = require('cors');

const app = express();
const port = 3001;

const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

const getCached = (key) => {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
        return entry.data;
    }
    cache.delete(key);
    return null;
};

const setCache = (key, data) => {
    cache.set(key, { data, timestamp: Date.now() });
};

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;

const rateLimit = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, []);
    }
    
    const requests = rateLimitMap.get(ip).filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    
    if (requests.length >= RATE_LIMIT_MAX_REQUESTS) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    
    requests.push(now);
    rateLimitMap.set(ip, requests);
    next();
};

setInterval(() => {
    const now = Date.now();
    for (const [ip, requests] of rateLimitMap.entries()) {
        const active = requests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
        if (active.length === 0) {
            rateLimitMap.delete(ip);
        } else {
            rateLimitMap.set(ip, active);
        }
    }
}, 5 * 60 * 1000);

const sanitizeUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    url = url.trim();
    // Remove dangerous characters
    if (url.includes('&&') || url.includes('||') || url.includes(';') || url.includes('`')) {
        return null;
    }
    return url;
};

app.use(cors());
app.use(express.json());
app.use(rateLimit);

const formatDuration = (seconds) => {
    if (isNaN(seconds) || seconds < 0) {
        return "0:00";
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const runCommand = (cmd, args = []) => new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true }, (error, stdout, stderr) => {
        if (error) {
            if (error.code === 'ENOENT' || /not found/i.test(String(stderr)) || /spawn .* ENOENT/.test(String(error))) {
                return reject(new Error('yt-dlp command not found. Please ensure it is installed and in your system\'s PATH.'));
            }
            return reject(new Error(stderr || String(error)));
        }
        resolve(stdout);
    });
});

app.post('/api/fetchPlaylist', async (req, res) => {
    const { playlistUrl } = req.body;

    if (!playlistUrl) {
        return res.status(400).json({ error: 'Playlist URL is required.' });
    }

    const sanitized = sanitizeUrl(playlistUrl);
    if (!sanitized) {
        return res.status(400).json({ error: 'Invalid or unsafe URL provided.' });
    }

    try {
        const url = new URL(sanitized);
        if (!url.hostname.includes('youtube.com') || !url.searchParams.has('list')) {
            return res.status(400).json({ error: 'Invalid YouTube playlist URL provided.' });
        }
    } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format.' });
    }
    
    const cacheKey = `playlist:${sanitized}`;
    const cached = getCached(cacheKey);
    if (cached) {
        console.log('Returning cached playlist data');
        return res.json(cached);
    }

    try {
        const stdout = await runCommand('yt-dlp', ['-J', '--flat-playlist', sanitized]);
        const data = JSON.parse(stdout);
        const formattedData = {
            playlistTitle: data.title || 'Untitled Playlist',
            videos: (data.entries || []).map(video => ({
                id: video.id,
                title: video.title || 'Untitled Video',
                duration: formatDuration(video.duration),
            })),
        };
        
        setCache(cacheKey, formattedData);
        
        return res.json(formattedData);
    } catch (err) {
        console.error('fetchPlaylist error:', err);
        const message = err && err.message ? err.message : String(err);
        const isNotFound = /yt-dlp command not found/i.test(message);
        return res.status(isNotFound ? 500 : 502).json({ error: message });
    }
});

app.get('/', (_req, res) => {
    res.json({ status: 'ok', message: 'LectureLane Backend Running' });
});

app.use('/app', express.static('public'));
app.get('/app/*', (_req, res) => {
    res.sendFile(require('path').join(__dirname, 'public', 'index.html'));
});

// Sync endpoint: always fetches fresh data from YouTube (no cache)
app.post('/api/syncPlaylist', async (req, res) => {
    const { playlistUrl } = req.body;

    if (!playlistUrl) {
        return res.status(400).json({ error: 'Playlist URL is required.' });
    }

    const sanitized = sanitizeUrl(playlistUrl);
    if (!sanitized) {
        return res.status(400).json({ error: 'Invalid or unsafe URL provided.' });
    }

    try {
        const url = new URL(sanitized);
        if (!url.hostname.includes('youtube.com') || !url.searchParams.has('list')) {
            return res.status(400).json({ error: 'Invalid YouTube playlist URL provided.' });
        }
    } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format.' });
    }

    try {
        console.log(`[Sync] Fetching fresh playlist data for: ${sanitized}`);
        const stdout = await runCommand('yt-dlp', ['-J', '--flat-playlist', sanitized]);
        const data = JSON.parse(stdout);
        const formattedData = {
            playlistTitle: data.title || 'Untitled Playlist',
            videos: (data.entries || []).map(video => ({
                id: video.id,
                title: video.title || 'Untitled Video',
                duration: formatDuration(video.duration),
            })),
        };

        // Also update the regular cache
        const cacheKey = `playlist:${sanitized}`;
        setCache(cacheKey, formattedData);

        console.log(`[Sync] Found ${formattedData.videos.length} videos in playlist`);
        return res.json(formattedData);
    } catch (err) {
        console.error('[Sync] Error:', err);
        const message = err && err.message ? err.message : String(err);
        const isNotFound = /yt-dlp command not found/i.test(message);
        return res.status(isNotFound ? 500 : 502).json({ error: message });
    }
});

app.get('/api/playlist', async (req, res) => {
    const playlistUrl = req.query.url;
    if (!playlistUrl) {
        return res.status(400).json({ error: 'Missing required query parameter: url' });
    }

    const sanitized = sanitizeUrl(playlistUrl);
    if (!sanitized) {
        return res.status(400).json({ error: 'Invalid or unsafe URL provided.' });
    }

    try {
        const url = new URL(sanitized);
        if (!url.hostname.includes('youtube.com') || !url.searchParams.has('list')) {
            return res.status(400).json({ error: 'Invalid YouTube playlist URL provided.' });
        }
    } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format.' });
    }

    const cacheKey = `playlist:${sanitized}`;
    const cached = getCached(cacheKey);
    if (cached) {
        console.log('Returning cached playlist data');
        return res.json(cached);
    }

    try {
        const stdout = await runCommand('yt-dlp', ['-J', '--flat-playlist', sanitized]);
        const data = JSON.parse(stdout);
        const formattedData = {
            playlistTitle: data.title || 'Untitled Playlist',
            videos: (data.entries || []).map(video => ({
                id: video.id,
                title: video.title || 'Untitled Video',
                duration: formatDuration(video.duration),
            })),
        };
        
        setCache(cacheKey, formattedData);
        
        res.json(formattedData);
    } catch (err) {
        const message = err && err.message ? err.message : String(err);
        const isNotFound = /yt-dlp command not found/i.test(message);
        return res.status(isNotFound ? 500 : 502).json({ error: message });
    }
});

app.get('/api/video/:id', async (req, res) => {
    const { id } = req.params;
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        return res.status(400).json({ error: 'Invalid video ID provided.' });
    }

    const cacheKey = `video:${id}`;
    const cached = getCached(cacheKey);
    if (cached) {
        console.log('Returning cached video data');
        return res.json(cached);
    }

    const videoUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
    try {
        const stdout = await runCommand('yt-dlp', ['-J', videoUrl]);
        const data = JSON.parse(stdout);
        const durationSeconds = Number(data.duration) || 0;
        const videoData = {
            id,
            title: data.title || 'Untitled Video',
            duration: formatDuration(durationSeconds),
            durationSeconds,
            thumbnails: data.thumbnails || [],
            uploader: data.uploader || null,
        };
        
        setCache(cacheKey, videoData);
        
        res.json(videoData);
    } catch (err) {
        const message = err && err.message ? err.message : String(err);
        const isNotFound = /yt-dlp command not found/i.test(message);
        return res.status(isNotFound ? 500 : 502).json({ error: message });
    }
});

app.get('/api/yt-dlp-version', async (_req, res) => {
    try {
        const stdout = await runCommand('yt-dlp', ['--version']);
        return res.json({ installed: true, version: (stdout || '').trim() });
    } catch (err) {
        const message = err && err.message ? err.message : String(err);
        return res.status(200).json({ installed: false, error: message });
    }
});

app.listen(port, () => {
    console.log(`LectureLane backend listening at http://localhost:${port}/app`);
    console.log('Ensure yt-dlp is installed and accessible in your system\'s PATH.');
});
