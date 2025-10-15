import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

// Helper: Generate YouTube embed URL with distraction-free parameters
const makeYouTubeEmbedUrl = (videoId, startTime = 0) => {
    const params = new URLSearchParams({
        enablejsapi: '1',
        autoplay: '1',
        playsinline: '1',
        rel: '0',
        iv_load_policy: '3',
        modestbranding: '1',
        origin: window.location.origin,
        start: Math.floor(startTime).toString()
    });
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
};

const useLocalStorage = (key, initialValue) => {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch {
            return initialValue;
        }
    });
    const setValue = (value) => {
        try {
            setStoredValue(prev => {
                const valueToStore = typeof value === 'function' ? value(prev) : value;
                try { window.localStorage.setItem(key, JSON.stringify(valueToStore)); } catch (e) {}
                return valueToStore;
            });
        } catch {}
    };
    return [storedValue, setValue];
};

const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
};

// Utilities
const parseDurationToSeconds = (text) => {
    if (!text) return 0;
    const parts = String(text).split(':').map(Number);
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) {
        const [h, m, s] = parts; return h * 3600 + m * 60 + s;
    } else if (parts.length === 2) {
        const [m, s] = parts; return m * 60 + s;
    } else if (parts.length === 1) {
        return parts[0];
    }
    return 0;
};

const StatCard = ({ value, label }) => (
    React.createElement('div', { className: 'card stat-card' }, [
        React.createElement('div', { key: 'v', className: 'value' }, value),
        React.createElement('div', { key: 'l', className: 'label' }, label)
    ])
);

const PlayerPage = ({ video, onBack, onProgressUpdate }) => {
    const [player, setPlayer] = useState(null);
    const intervalRef = React.useRef(null);
    const iframeId = `ytplayer-${video.id}`;

    const cleanup = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (player && player.destroy) player.destroy();
        setPlayer(null);
    };

    useEffect(() => {
        const createPlayer = () => {
            const instance = new window.YT.Player(iframeId, {
                videoId: video.id,
                playerVars: { 
                    autoplay: 1, 
                    playsinline: 1, 
                    origin: window.location.origin, 
                    rel: 0, 
                    start: Math.floor(video.watchTime || 0),
                    iv_load_policy: 3,
                    disablekb: 0,
                    fs: 1,
                    modestbranding: 1
                },
                events: {
                    onStateChange: (event) => {
                        if (intervalRef.current) clearInterval(intervalRef.current);
                        const YTPS = window.YT && window.YT.PlayerState;
                        if (event.data === YTPS.PLAYING) {
                            let lastTime = instance.getCurrentTime();
                            intervalRef.current = setInterval(() => {
                                const currentTime = instance.getCurrentTime();
                                const diff = currentTime - lastTime;
                                if (diff > 0) onProgressUpdate(currentTime, diff);
                                lastTime = currentTime;
                            }, 5000);
                        }
                    }
                }
            });
            setPlayer(instance);
        };

        if (window.YT && window.YT.Player) {
            createPlayer();
        } else {
            window.onYouTubeIframeAPIReady = createPlayer;
        }
        return () => cleanup();
    }, [video.id]);

    return (
        React.createElement('div', null, [
            React.createElement('button', { key: 'back', className: 'btn btn-secondary', onClick: onBack }, '← Back'),
            React.createElement('h1', { key: 't', style: { margin: '1rem 0' } }, video.title || 'Now Playing'),
            React.createElement('div', { key: 'wrap', className: 'video-player-container' },
                React.createElement('iframe', {
                    id: iframeId,
                    src: makeYouTubeEmbedUrl(video.id, video.watchTime || 0),
                    allow: 'autoplay; encrypted-media; picture-in-picture',
                    allowFullScreen: true,
                    frameBorder: '0',
                    style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }
                })
            )
        ])
    );
};

const Sidebar = ({ currentView, setView, isSidebarOpen, theme, toggleTheme }) => (
    React.createElement('aside', { className: `sidebar ${isSidebarOpen ? 'open' : 'closed'}` }, [
        React.createElement('h1', { key: 'logo', className: 'logo' }, 'LectureLane'),
        React.createElement('ul', { key: 'menu', className: 'nav-menu' }, [
            React.createElement('li', { key: 'dash', className: 'nav-item' },
                React.createElement('button', { onClick: () => setView('dashboard'), className: currentView === 'dashboard' ? 'active' : '' }, '🏠 Dashboard')
            ),
            React.createElement('li', { key: 'subjects', className: 'nav-item' },
                React.createElement('button', { onClick: () => setView('subjects'), className: currentView === 'subjects' ? 'active' : '' }, '📚 Subjects')
            ),
            React.createElement('li', { key: 'progress', className: 'nav-item' },
                React.createElement('button', { onClick: () => setView('progress'), className: currentView === 'progress' ? 'active' : '' }, '📊 My Progress')
            ),
            React.createElement('li', { key: 'settings', className: 'nav-item' },
                React.createElement('button', { onClick: () => setView('settings'), className: currentView === 'settings' ? 'active' : '' }, '⚙️ Settings')
            ),
            React.createElement('li', { key: 'theme', className: 'nav-item' },
                React.createElement('button', { onClick: toggleTheme, className: 'theme-toggle' }, theme === 'dark' ? '🌙 Dark' : '☀️ Light')
            ),
        ])
    ])
);

const Dashboard = ({ subjects, onAddClick, onOpenSubject }) => {
    const stats = useMemo(() => {
        let totalVideos = 0;
        let completedVideos = 0;
        subjects.forEach(s => {
            totalVideos += s.videos.length;
            completedVideos += s.videos.filter(v => v.status === 'Completed').length;
        });
        return { totalSubjects: subjects.length, totalVideos, completedVideos };
    }, [subjects]);

    return (
        React.createElement(React.Fragment, null, [
            React.createElement('h1', { key: 'h' }, 'Dashboard'),
            React.createElement('div', { key: 'stats', className: 'grid' }, [
                React.createElement(StatCard, { key: 's1', value: stats.totalSubjects, label: 'Total Subjects' }),
                React.createElement(StatCard, { key: 's2', value: stats.totalVideos, label: 'Total Videos' }),
                React.createElement(StatCard, { key: 's3', value: stats.completedVideos, label: 'Completed Videos' })
            ]),
            React.createElement('div', { key: 'actions', style: { margin: '1rem 0' } },
                React.createElement('button', { className: 'btn', onClick: onAddClick }, 'Add New Subject')
            ),
            React.createElement('h2', { key: 'hs', style: { marginTop: '3rem' } }, 'Your Subjects'),
            React.createElement('div', { key: 'grid', className: 'grid' },
                subjects.map(s => (
                    React.createElement('div', { key: s.id, className: 'card subject-card', onClick: () => onOpenSubject(s.id) }, [
                        React.createElement('h3', { key: 't' }, s.name),
                        React.createElement('p', { key: 'pt' }, s.playlistTitle),
                        React.createElement('div', { key: 'pbc', className: 'progress-bar-container' },
                            React.createElement('div', { className: 'progress-bar', style: { width: `${(s.videos.filter(v => v.status === 'Completed').length / (s.videos.length || 1)) * 100}%` } })
                        )
                    ])
                ))
            )
        ])
    );
};

const DashboardOnly = ({ subjects, onAddClick, goSubjects }) => {
    const stats = useMemo(() => {
        const totals = subjects.reduce((acc, s) => {
            s.videos.forEach(v => {
                acc.totalSeconds += v.durationSeconds || 0;
                if (v.status === 'Completed') {
                    acc.watchedSeconds += v.durationSeconds || 0;
                    acc.completed++;
                } else if (v.status === 'In Progress' && v.watchTime > 0) {
                    acc.watchedSeconds += v.watchTime;
                }
                acc.totalVideos++;
            });
            return acc;
        }, { totalSeconds: 0, watchedSeconds: 0, totalVideos: 0, completed: 0 });
            const toHhMm = (secs) => {
                secs = Math.floor(secs);
                const h = Math.floor(secs / 3600);
                const m = Math.floor((secs % 3600) / 60);
                return `${h}h ${m}m`;
            };
        const overallProgress = totals.totalVideos > 0 
            ? Math.round((totals.completed / totals.totalVideos) * 100)
            : 0;
        const continueWatching = subjects
            .flatMap(s => s.videos.map(v => ({ ...v, subject: s.name, subjectId: s.id })))
            .filter(v => (v.watchTime || 0) > 0 && v.status !== 'Completed');
        return {
            totalSubjects: subjects.length,
            totalVideos: totals.totalVideos,
            completedVideos: totals.completed,
            totalDuration: toHhMm(totals.totalSeconds),
            watchedDuration: toHhMm(totals.watchedSeconds),
            overallProgress: `${overallProgress}%`,
            continueWatching
        };
    }, [subjects]);

    return React.createElement(React.Fragment, null, [
        React.createElement('h1', { key: 'h' }, 'Dashboard'),
        React.createElement('div', { key: 'grid', className: 'grid' }, [
            React.createElement(StatCard, { key: 's1', value: stats.totalSubjects, label: 'Total Subjects' }),
            React.createElement(StatCard, { key: 'v1', value: stats.totalVideos, label: 'Total Videos' }),
            React.createElement(StatCard, { key: 'v2', value: stats.completedVideos, label: 'Completed Videos' }),
            React.createElement(StatCard, { key: 'v3', value: stats.totalDuration, label: 'Total Duration' }),
            React.createElement(StatCard, { key: 'v4', value: stats.watchedDuration, label: 'Watched Duration' }),
            React.createElement(StatCard, { key: 'v5', value: stats.overallProgress, label: 'Overall Progress' })
        ]),
        React.createElement('div', { key: 'actions-top', style: { margin: '1rem 0', display: 'flex', gap: '1rem' } },
            React.createElement('button', { className: 'btn', onClick: onAddClick }, 'Add New Subject'),
            React.createElement('button', { className: 'btn btn-secondary', onClick: goSubjects }, 'Go to Subjects')
        ),
        stats.continueWatching.length > 0 ? React.createElement('h2', { key: 'cw-h', style: { marginTop: '2rem' } }, 'Continue Watching') : null,
        stats.continueWatching.length > 0 ? React.createElement('div', { key: 'cw', className: 'grid' },
            stats.continueWatching.map(v => (
                React.createElement('div', { key: v.id, className: 'card video-card' }, [
                    React.createElement('div', { key: 'thumb', className: 'video-thumbnail-container' },
                        React.createElement('img', { className: 'video-thumbnail', alt: v.title, src: v.thumbnail || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg` })
                    ),
                    React.createElement('div', { key: 'info', className: 'video-info' }, [
                        React.createElement('p', { key: 'title', className: 'video-title' }, v.title),
                        React.createElement('div', { key: 'meta', style: { opacity: 0.8, marginTop: 4 } }, (() => {
                            const totalMinutes = Math.floor((v.watchTime || 0) / 60);
                            const hours = Math.floor(totalMinutes / 60);
                            const minutes = totalMinutes % 60;
                            const timeStr = hours > 0 ? `${hours}h ${minutes}m watched` : `${minutes}m watched`;
                            return `${timeStr} · ${v.subject}`;
                        })()),
                        React.createElement('div', { key: 'actions', className: 'video-actions' }, [
                            React.createElement('button', { key: 'resume', className: 'status-btn watch', onClick: () => window.dispatchEvent(new CustomEvent('open-global-player', { detail: { id: v.id, title: v.title, watchTime: v.watchTime || 0, subjectId: v.subjectId } })) }, 'Resume')
                        ])
                    ])
                ])
            ))
        ) : null,
        // Plan Next: for each subject that has a continueWatching item, show the next video in that subject
        (() => {
                // Determine last-seen index per subject (completed OR has timeSpent/watchTime)
                const bySubjectLastSeen = {};
                subjects.forEach(subj => {
                    // find the highest index where video is completed or has timeSpent/watchTime
                    let lastSeenIdx = -1;
                    subj.videos.forEach((v, i) => {
                        if (v.status === 'Completed' || (v.timeSpent || 0) > 0 || (v.watchTime || 0) > 0) {
                            lastSeenIdx = i;
                        }
                    });
                    if (lastSeenIdx >= 0) bySubjectLastSeen[subj.name] = lastSeenIdx;
                });

                const planNext = Object.keys(bySubjectLastSeen).map(subjectName => {
                    const subj = subjects.find(s => s.name === subjectName);
                    if (!subj) return null;
                    const idx = bySubjectLastSeen[subjectName];
                    if (idx >= 0 && idx + 1 < subj.videos.length) {
                        const next = subj.videos[idx + 1];
                        // only show if next is not already completed
                        if (next.status !== 'Completed') return { ...next, subject: subj.name, subjectId: subj.id };
                    }
                    return null;
                }).filter(Boolean);

            return planNext.length > 0 ? React.createElement(React.Fragment, null, [
                React.createElement('h2', { key: 'pn-h', style: { marginTop: '2rem' } }, 'Play Next'),
                React.createElement('div', { key: 'pn', className: 'grid' },
                    planNext.map(v => (
                        React.createElement('div', { key: v.id, className: 'card video-card' }, [
                            React.createElement('div', { key: 'thumb', className: 'video-thumbnail-container' },
                                React.createElement('img', { className: 'video-thumbnail', alt: v.title, src: v.thumbnail || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg` })
                            ),
                            React.createElement('div', { key: 'info', className: 'video-info' }, [
                                React.createElement('p', { key: 'title', className: 'video-title' }, v.title),
                                React.createElement('div', { key: 'meta', style: { opacity: 0.8, marginTop: 4 } }, `${v.subject}`),
                                React.createElement('div', { key: 'actions', className: 'video-actions' }, [
                                    React.createElement('button', { key: 'start', className: 'status-btn watch', onClick: () => window.dispatchEvent(new CustomEvent('open-global-player', { detail: { id: v.id, title: v.title, watchTime: 0, subjectId: v.subjectId } })) }, 'Start Next')
                                ])
                            ])
                        ])
                    ))
                )
            ]) : null;
        })(),
        // Removed duplicate bottom 'Go to Subjects' button — it's now adjacent to 'Add New Subject' above
    ]);
};

// New: Subjects listing view
const SubjectsList = ({ subjects, onOpenSubject, setView }) => (
    React.createElement(React.Fragment, null, [
        React.createElement('h1', { key: 'h' }, 'Subjects'),
        React.createElement('div', { key: 'actions', style: { margin: '1rem 0' } },
            React.createElement('button', { className: 'btn', onClick: () => setView('setup') }, 'Add New Subject')
        ),
        React.createElement('div', { key: 'grid', className: 'grid' },
            subjects.map(s => (
                React.createElement('div', { key: s.id, className: 'card subject-card', onClick: () => onOpenSubject(s.id) }, [
                    React.createElement('h3', { key: 't' }, s.name),
                    React.createElement('p', { key: 'pt' }, s.playlistTitle),
                    React.createElement('div', { key: 'pbc', className: 'progress-bar-container' },
                        React.createElement('div', { className: 'progress-bar', style: { width: `${(s.videos.filter(v => v.status === 'Completed').length / (s.videos.length || 1)) * 100}%` } })
                    ),
                    React.createElement('p', { key: 'count', style: { marginTop: '0.5rem', color: 'var(--text-secondary)' } }, `${s.videos.length} videos`)
                ])
            ))
        )
    ])
);

// Progress view with bars per subject and totals
const ProgressView = ({ subjects }) => {
    const data = useMemo(() => {
        const perSubject = subjects.map(s => {
            const completed = s.videos.filter(v => v.status === 'Completed').length;
            const watchedSeconds = s.videos.reduce((t, v) => t + (v.timeSpent || 0), 0);
            const totalSeconds = s.videos.reduce((t, v) => t + (v.durationSeconds || 0), 0);
            return { id: s.id, name: s.name, completed, total: s.videos.length, watchedSeconds, totalSeconds };
        });
        const totalWatched = perSubject.reduce((t, s) => t + s.watchedSeconds, 0);
        const totalSeconds = perSubject.reduce((t, s) => t + s.totalSeconds, 0);
        const toHhMm = (secs) => { const h = Math.floor(secs / 3600); const m = Math.floor((secs % 3600) / 60); return `${h}h ${m}m`; };
        return { perSubject, totalWatched: toHhMm(totalWatched), totalDuration: toHhMm(totalSeconds) };
    }, [subjects]);

    return React.createElement(React.Fragment, null, [
        React.createElement('h1', { key: 'h' }, 'My Progress'),
        React.createElement('div', { key: 'totals', className: 'grid' }, [
            React.createElement(StatCard, { key: 'tw', value: data.totalWatched, label: 'Watched' }),
            React.createElement(StatCard, { key: 'td', value: data.totalDuration, label: 'Total Duration' })
        ]),
        React.createElement('div', { key: 'list', className: 'grid', style: { marginTop: '1rem' } },
            data.perSubject.map(s => (
                React.createElement('div', { key: s.id, className: 'card' }, [
                    React.createElement('h3', { key: 'n' }, s.name),
                    React.createElement('p', { key: 'c', style: { color: 'var(--text-secondary)' } }, `${s.completed}/${s.total} completed`),
                    React.createElement('div', { key: 'bar', className: 'progress-bar-container' },
                        React.createElement('div', { className: 'progress-bar', style: { width: `${(s.completed / (s.total || 1)) * 100}%` } })
                    )
                ])
            ))
        )
    ]);
};

// Settings view for reset and manage subjects
const SettingsView = ({ subjects, setSubjects, setView }) => {
    const clearAll = () => {
        if (confirm('This will remove all your data. Continue?')) {
            setSubjects([]);
            setView('dashboard');
        }
    };
    const deleteSubject = (id) => {
        if (confirm('Delete this subject?')) {
            setSubjects(subjects.filter(s => s.id !== id));
        }
    };
    return React.createElement(React.Fragment, null, [
        React.createElement('h1', { key: 'h', style: { marginBottom: '2rem' } }, 'Settings'),
        React.createElement('div', {
            key: 'sec1',
            className: 'settings-section'
        }, [
            React.createElement('h2', { key: 't' }, 'Data Management'),
            React.createElement('p', { key: 'p', style: { color: 'var(--text-secondary)', marginBottom: '1.5rem' } }, 'This will permanently delete all your subjects and progress.'),
            React.createElement('button', {
                key: 'btn',
                className: 'btn btn-danger',
                onClick: clearAll
            }, 'Reset Application')
        ]),
        React.createElement('div', {
            key: 'sec2',
            className: 'settings-section'
        }, [
            React.createElement('h2', { key: 't' }, 'Manage Subjects'),
            subjects.length === 0 ? React.createElement('p', { key: 'empty', style: { color: 'var(--text-secondary)' } }, 'No subjects yet.') :
            React.createElement('div', {
                key: 'list',
                className: 'settings-subject-list'
            },
                subjects.map(s => (
                    React.createElement('div', {
                        key: s.id,
                        className: 'settings-subject-card'
                    }, [
                        React.createElement('div', {
                            key: 'txt',
                            className: 'settings-subject-info'
                        }, [
                            React.createElement('div', {
                                key: 'n',
                                className: 'settings-subject-name'
                            }, s.name),
                            React.createElement('div', {
                                key: 'p',
                                className: 'settings-subject-count'
                            }, `${s.videos.length} videos`)
                        ]),
                        React.createElement('button', {
                            key: 'del',
                            className: 'btn btn-danger',
                            onClick: () => deleteSubject(s.id)
                        }, 'Delete')
                    ])
                ))
            )
        ])
    ]);
};

const PlayerShell = () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const t = Number(params.get('t') || 0);
    const title = params.get('title') || 'Now Playing';
    const subjectId = params.get('subjectId');
    const playerRef = React.useRef(null);
    
    const [playlistContext, setPlaylistContext] = useState(null);
    const [showCalculator, setShowCalculator] = useState(false);
    const [calcDisplay, setCalcDisplay] = useState('0');
    const [calcPrevValue, setCalcPrevValue] = useState(null);
    const [calcOperation, setCalcOperation] = useState(null);
    const [calcNewNumber, setCalcNewNumber] = useState(true);
    const [showToggle, setShowToggle] = useState(true);
    const timersRef = React.useRef([]);
    
    useEffect(() => {
        if (subjectId) {
            try {
                const stored = localStorage.getItem('lectureLaneSubjects');
                const subjects = stored ? JSON.parse(stored) : [];
                const subject = subjects.find(s => s.id === subjectId);
                if (subject && subject.videos) {
                    const currentIndex = subject.videos.findIndex(v => v.id === id);
                    const nextVideos = currentIndex >= 0 ? subject.videos.slice(currentIndex + 1, currentIndex + 2) : [];
                    setPlaylistContext({
                        subject,
                        currentIndex,
                        nextVideos
                    });
                }
            } catch (e) {
                console.error('Failed to load playlist context:', e);
            }
        }
    }, [id, subjectId]);

    if (!id) return React.createElement('div', null, 'Missing video id');

    useEffect(() => {
        const handleKeyDown = (e) => {
            const player = playerRef.current;
            if (!player) return;
            
            if (e.code === 'Space' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
            }
            
            if (e.code === 'Space') {
                try {
                    const state = player.getPlayerState ? player.getPlayerState() : -1;
                    const YTPS = window.YT && window.YT.PlayerState;
                    if (!YTPS) return;
                    if (state === YTPS.PLAYING) {
                        player.pauseVideo();
                    } else {
                        player.playVideo();
                    }
                } catch (err) {
                    console.error('Keyboard shortcut error:', err);
                }
            } else if (e.key === 'ArrowLeft') {
                try {
                    const current = player.getCurrentTime ? player.getCurrentTime() : 0;
                    player.seekTo(Math.max(0, current - 5), true);
                } catch (err) {
                    console.error('Seek error:', err);
                }
            } else if (e.key === 'ArrowRight') {
                try {
                    const current = player.getCurrentTime ? player.getCurrentTime() : 0;
                    player.seekTo(current + 5, true);
                } catch (err) {
                    console.error('Seek error:', err);
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const channel = new BroadcastChannel('lecturelane-progress');
        let player = null;
        let lastTime = t || 0;
        let lastReported = t || 0;
        let tickId = null;
        let lastPlaybackRate = 1;
        const tick = () => {
            if (!player || !player.getCurrentTime) return;
            const now = player.getCurrentTime();
            const dur = (player.getDuration && player.getDuration()) || 0;
            const rawDelta = now - lastTime;
            const isSeek = Math.abs(rawDelta) > 45;
            const delta = isSeek ? 0 : Math.max(0, Math.min(rawDelta, 30));
            lastTime = now;
            if (delta > 0 || Math.abs(now - lastReported) > 1) {
                lastReported = now;
                try { lastPlaybackRate = player.getPlaybackRate ? player.getPlaybackRate() : lastPlaybackRate; } catch {}
                channel.postMessage({
                    type: 'progress',
                    id,
                    currentTime: now,
                    duration: dur,
                    delta,
                    rate: lastPlaybackRate
                });
            }
        };
        const onStateChange = (event) => {
            const YTPS = window.YT && window.YT.PlayerState;
            if (!YTPS) return;
            if (tickId) { clearInterval(tickId); tickId = null; }
            if (event.data === YTPS.PLAYING) {
                tick();
                tickId = setInterval(tick, 5000);
            } else if (event.data === YTPS.ENDED) {
                const dur = (player.getDuration && player.getDuration()) || 0;
                channel.postMessage({ type: 'ended', id, duration: dur });
            }
        };
        const create = () => {
            player = new window.YT.Player(`ytplayer-${id}`, {
                videoId: id,
                playerVars: { 
                    autoplay: 1, 
                    playsinline: 1, 
                    rel: 0, 
                    origin: window.location.origin, 
                    start: Math.floor(t),
                    iv_load_policy: 3,
                    disablekb: 0,
                    fs: 1,
                    modestbranding: 1
                },
                events: {
                    onStateChange,
                    onReady: (event) => {
                        playerRef.current = event.target;
                        try { event.target.playVideo(); } catch {}
                        try {
                            if (event.target.setOption) {
                                event.target.setOption('captions', 'fontSize', 0);
                            }
                            if (event.target.unloadModule) {
                                event.target.unloadModule('annotations');
                            }
                        } catch (e) {
                            console.log('Could not disable overlay via API');
                        }
                    }
                }
            });
        };
        if (window.YT && window.YT.Player) {
            create();
        } else {
            window.onYouTubeIframeAPIReady = create;
        }
        return () => { if (tickId) clearInterval(tickId); channel.close(); if (player && player.destroy) player.destroy(); };
    }, [id, t]);

    // Calculator functions
    const handleCalcNumber = (num) => {
        if (calcNewNumber) {
            setCalcDisplay(String(num));
            setCalcNewNumber(false);
        } else {
            setCalcDisplay(calcDisplay === '0' ? String(num) : calcDisplay + num);
        }
    };

    const handleCalcOperation = (op) => {
        const current = parseFloat(calcDisplay || '0');
        if (calcPrevValue !== null && calcOperation && !calcNewNumber) {
            const result = performCalculation(calcPrevValue, current, calcOperation);
            setCalcDisplay(String(result));
            setCalcPrevValue(result);
        } else {
            setCalcPrevValue(current);
        }
        setCalcOperation(op);
        setCalcNewNumber(true);
    };

    const performCalculation = (prev, current, op) => {
        switch (op) {
            case '+': return prev + current;
            case '-': return prev - current;
            case '×': return prev * current;
            case '÷': return current !== 0 ? prev / current : 0;
            case '^': return Math.pow(prev, current);
            case '%': return (prev * current) / 100;
            default: return current;
        }
    };

    const handleCalcEquals = () => {
        if (calcPrevValue !== null && calcOperation) {
            const current = parseFloat(calcDisplay || '0');
            const result = performCalculation(calcPrevValue, current, calcOperation);
            setCalcDisplay(String(result));
            setCalcPrevValue(null);
            setCalcOperation(null);
            setCalcNewNumber(true);
        }
    };

    const handleCalcClear = () => {
        setCalcDisplay('0');
        setCalcPrevValue(null);
        setCalcOperation(null);
        setCalcNewNumber(true);
    };

    const handleCalcDecimal = () => {
        if (calcNewNumber) {
            setCalcDisplay('0.');
            setCalcNewNumber(false);
        } else if (!calcDisplay.includes('.')) {
            setCalcDisplay(calcDisplay + '.');
        }
    };

    // Unary engineering functions (apply immediately)
    const handleCalcUnary = (op) => {
        const current = parseFloat(calcDisplay || '0');
        let result = current;
        try {
            switch (op) {
                case 'sqrt': result = Math.sqrt(current); break;
                case 'sin': result = Math.sin(current); break;
                case 'cos': result = Math.cos(current); break;
                case 'tan': result = Math.tan(current); break;
                case 'ln': result = Math.log(current); break;
                case 'log': result = Math.log10 ? Math.log10(current) : Math.log(current) / Math.LN10; break;
                case 'percent': result = current / 100; break;
                case 'fact': // simple factorial for small ints
                    if (current < 0) result = NaN;
                    else {
                        let n = Math.floor(current);
                        let f = 1;
                        for (let i = 2; i <= n; i++) f *= i;
                        result = f;
                    }
                    break;
                case 'pi': result = Math.PI; break;
                case 'e': result = Math.E; break;
                case 'recip': result = current !== 0 ? 1 / current : NaN; break;
                case '10pow': result = Math.pow(10, current); break;
                case 'abs': result = Math.abs(current); break;
            }
        } catch (e) { result = NaN; }
        setCalcDisplay(String(result));
        setCalcNewNumber(true);
    };

    // Keyboard handling for calculator when open
    useEffect(() => {
        const onKey = (e) => {
            if (!showCalculator) return;
            // Prevent interfering with video shortcuts when calculator is open
            e.stopPropagation();
            e.preventDefault();
            const k = e.key;
            if ((/^[0-9]$/).test(k)) return handleCalcNumber(Number(k));
            if (k === '.') return handleCalcDecimal();
            if (k === '+' || k === '-') return handleCalcOperation(k);
            if (k === '*' || k === 'x' || k === 'X') return handleCalcOperation('×');
            if (k === '/') return handleCalcOperation('÷');
            if (k === 'Enter' || k === '=') return handleCalcEquals();
            if (k === 'Backspace') return setCalcDisplay(calcDisplay.length > 1 ? calcDisplay.slice(0, -1) : '0');
            if (k === 'Escape') {
                // close calculator and restore toggle after animation
                setShowCalculator(false);
                const t = setTimeout(() => setShowToggle(true), 420);
                timersRef.current.push(t);
                return;
            }
            if (k === 'c' || k === 'C') return handleCalcClear();
            // simple unary shortcuts
            if (k === 's') return handleCalcUnary('sin');
            if (k === 'o') return handleCalcUnary('cos');
            if (k === 't') return handleCalcUnary('tan');
            if (k === 'r') return handleCalcUnary('sqrt');
            if (k === '%') return handleCalcUnary('percent');
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [showCalculator, calcDisplay, calcNewNumber, calcPrevValue, calcOperation]);

    // cleanup timers on unmount
    useEffect(() => {
        return () => {
            timersRef.current.forEach(t => clearTimeout(t));
            timersRef.current = [];
        };
    }, []);

    return React.createElement('div', { className: 'player-shell' }, [
        React.createElement('button', { key: 'calc-mini', className: `mini-btn calc-mini ${showCalculator ? 'active' : ''} ${showToggle ? '' : 'hidden'}`, onClick: () => { setShowToggle(false); const t = setTimeout(() => setShowCalculator(true), 220); timersRef.current.push(t); }, title: 'Calculator' }, '🧮'),
        React.createElement('div', { key: 'hdr', className: 'player-shell-header' }, [
            React.createElement('button', { key: 'back', className: 'btn btn-secondary', onClick: () => window.close() }, '←'),
            React.createElement('h1', { key: 't', className: 'player-shell-title' }, decodeURIComponent(title))
        ]),
        React.createElement('div', { key: 'calculator', className: `calculator-widget ${showCalculator ? 'open' : 'closed'}` }, [
            React.createElement('div', { key: 'calc-header', className: 'calc-header' }, [
                React.createElement('div', { key: 'hdr-left', className: 'calc-title' }, 'Calculator'),
                React.createElement('button', { key: 'hdr-close', className: 'calc-close-btn', onClick: () => { setShowCalculator(false); const t = setTimeout(() => setShowToggle(true), 420); timersRef.current.push(t); }, title: 'Close' }, '×')
            ]),
            React.createElement('div', { key: 'display', className: 'calc-display' }, calcDisplay),
            React.createElement('div', { key: 'buttons', className: 'calc-buttons' }, [
                // Row1
                React.createElement('button', { key: 'pi', className: 'calc-btn', onClick: () => handleCalcUnary('pi') }, 'π'),
                React.createElement('button', { key: 'e', className: 'calc-btn', onClick: () => handleCalcUnary('e') }, 'e'),
                React.createElement('button', { key: 'recip', className: 'calc-btn', onClick: () => handleCalcUnary('recip') }, '1/x'),
                React.createElement('button', { key: '10pow', className: 'calc-btn', onClick: () => handleCalcUnary('10pow') }, '10^x'),
                React.createElement('button', { key: 'c', className: 'calc-btn calc-btn-clear', onClick: handleCalcClear }, 'C'),

                // Row2
                React.createElement('button', { key: '7', className: 'calc-btn', onClick: () => handleCalcNumber(7) }, '7'),
                React.createElement('button', { key: '8', className: 'calc-btn', onClick: () => handleCalcNumber(8) }, '8'),
                React.createElement('button', { key: '9', className: 'calc-btn', onClick: () => handleCalcNumber(9) }, '9'),
                React.createElement('button', { key: 'div', className: 'calc-btn calc-btn-op', onClick: () => handleCalcOperation('÷') }, '÷'),
                React.createElement('button', { key: 'pow', className: 'calc-btn calc-btn-op', onClick: () => handleCalcOperation('^') }, '^'),

                // Row3
                React.createElement('button', { key: '4', className: 'calc-btn', onClick: () => handleCalcNumber(4) }, '4'),
                React.createElement('button', { key: '5', className: 'calc-btn', onClick: () => handleCalcNumber(5) }, '5'),
                React.createElement('button', { key: '6', className: 'calc-btn', onClick: () => handleCalcNumber(6) }, '6'),
                React.createElement('button', { key: 'mul', className: 'calc-btn calc-btn-op', onClick: () => handleCalcOperation('×') }, '×'),
                React.createElement('button', { key: 'sqrt', className: 'calc-btn', onClick: () => handleCalcUnary('sqrt') }, '√'),

                // Row4
                React.createElement('button', { key: '1', className: 'calc-btn', onClick: () => handleCalcNumber(1) }, '1'),
                React.createElement('button', { key: '2', className: 'calc-btn', onClick: () => handleCalcNumber(2) }, '2'),
                React.createElement('button', { key: '3', className: 'calc-btn', onClick: () => handleCalcNumber(3) }, '3'),
                React.createElement('button', { key: 'sub', className: 'calc-btn calc-btn-op', onClick: () => handleCalcOperation('-') }, '-'),
                React.createElement('button', { key: 'sin', className: 'calc-btn', onClick: () => handleCalcUnary('sin') }, 'sin'),

                // Row5
                React.createElement('button', { key: '0', className: 'calc-btn', onClick: () => handleCalcNumber(0) }, '0'),
                React.createElement('button', { key: 'dot', className: 'calc-btn', onClick: handleCalcDecimal }, '.'),
                React.createElement('button', { key: 'eq', className: 'calc-btn calc-btn-equals', onClick: handleCalcEquals }, '='),
                React.createElement('button', { key: 'add', className: 'calc-btn calc-btn-op', onClick: () => handleCalcOperation('+') }, '+'),
                React.createElement('button', { key: 'cos', className: 'calc-btn', onClick: () => handleCalcUnary('cos') }, 'cos'),

                // Row6
                React.createElement('button', { key: 'ln', className: 'calc-btn', onClick: () => handleCalcUnary('ln') }, 'ln'),
                React.createElement('button', { key: 'log', className: 'calc-btn', onClick: () => handleCalcUnary('log') }, 'log'),
                React.createElement('button', { key: 'perc', className: 'calc-btn', onClick: () => handleCalcUnary('percent') }, '%'),
                React.createElement('button', { key: 'fact', className: 'calc-btn', onClick: () => handleCalcUnary('fact') }, 'n!'),
                React.createElement('button', { key: 'tan', className: 'calc-btn', onClick: () => handleCalcUnary('tan') }, 'tan')
            ])
        ]),
        React.createElement('div', { key: 'layout', className: 'player-layout' }, [
            React.createElement('div', { key: 'wrap', className: 'video-player-container' },
                React.createElement('iframe', {
                    id: `ytplayer-${id}`,
                    src: makeYouTubeEmbedUrl(id, t),
                    allow: 'autoplay; encrypted-media; picture-in-picture',
                    allowFullScreen: true,
                    frameBorder: '0',
                    style: { width: '100%', height: '100%', border: 0 }
                })
            ),
            playlistContext && playlistContext.nextVideos.length > 0 && React.createElement('div', { key: 'suggestions', className: 'play-next-sidebar' }, [
                React.createElement('h2', { key: 'title', className: 'play-next-title' }, 'Play Next'),
                React.createElement('div', { key: 'list', className: 'play-next-list' },
                    playlistContext.nextVideos.map((video, idx) => 
                        React.createElement('div', { 
                            key: video.id, 
                            className: 'play-next-item',
                            onClick: () => {
                                const newParams = new URLSearchParams({ 
                                    id: video.id, 
                                    t: Math.floor(video.watchTime || 0), 
                                    title: video.title || '',
                                    subjectId: subjectId
                                });
                                window.location.href = `/app/?player=1&${newParams.toString()}`;
                            }
                        }, [
                            React.createElement('img', { 
                                key: 'thumb',
                                className: 'play-next-thumbnail', 
                                alt: video.title, 
                                src: `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`,
                                loading: 'lazy'
                            }),
                            React.createElement('div', { key: 'info', className: 'play-next-info' }, [
                                React.createElement('div', { key: 'title', className: 'play-next-video-title' }, video.title),
                                React.createElement('div', { key: 'duration', className: 'play-next-duration' }, 
                                    video.durationSeconds ? `${Math.floor(video.durationSeconds / 60)}:${String(video.durationSeconds % 60).padStart(2, '0')}` : ''
                                ),
                                video.status === 'Completed' && React.createElement('span', { key: 'badge', className: 'play-next-badge' }, '✓ Completed')
                            ])
                        ])
                    )
                )
            ])
        ])
    ]);
};

const SetupScreen = ({ onSave }) => {
    const [subjects, setSubjects] = useState([{ name: '', url: '' }]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAddRow = () => setSubjects(prev => [...prev, { name: '', url: '' }]);
    const handleChange = (idx, field, value) => {
        setSubjects(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        setError('');
        const result = [];
        for (const s of subjects) {
            if (!s.name || !s.url) continue;
            try {
                // Use POST /api/fetchPlaylist for more robust backend handling
                const res = await fetch('/api/fetchPlaylist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ playlistUrl: s.url })
                });
                if (!res.ok) {
                    const errJson = await res.json().catch(() => ({}));
                    throw new Error(errJson.error || 'bad_response');
                }
                const data = await res.json();
                result.push({
                    id: s.name.toLowerCase().replace(/\s+/g, '-'),
                    name: s.name,
                    playlistId: (() => { try { return new URL(s.url).searchParams.get('list'); } catch { return ''; } })(),
                    playlistTitle: data.playlistTitle || s.name,
                    videos: (data.videos || []).map(v => ({
                        id: v.id,
                        title: v.title,
                        duration: v.duration,
                        durationSeconds: parseDurationToSeconds(v.duration),
                        thumbnail: `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
                        status: 'Not Started',
                        watchTime: 0,
                        timeSpent: 0,
                        notes: ''
                    })),
                    isPinned: false
                });
            } catch (e) {
                setError('Failed to load playlist');
                setIsLoading(false);
                return;
            }
        }
        if (result.length === 0) {
            setError('Please add at least one valid subject.');
            setIsLoading(false);
            return;
        }
        onSave(result);
    };

    return (
        React.createElement('div', { className: 'setup-container' }, [
            React.createElement('h1', { key: 'h' }, 'Welcome to LectureLane'),
            error ? React.createElement('div', { key: 'e', style: { color: '#ff8a8a', marginBottom: '1rem' } }, error) : null,
            subjects.map((s, i) => (
                React.createElement('div', { key: i, className: 'subject-input-group' }, [
                    React.createElement('input', { key: 'n', type: 'text', placeholder: 'Subject Name (e.g., Physics)', value: s.name, onChange: e => handleChange(i, 'name', e.target.value) }),
                    React.createElement('input', { key: 'u', type: 'text', placeholder: 'YouTube Playlist URL', value: s.url, onChange: e => handleChange(i, 'url', e.target.value) })
                ])
            )),
            React.createElement('div', { key: 'btns', style: { display: 'flex', gap: '1rem', justifyContent: 'center' } }, [
                React.createElement('button', { key: 'add', className: 'btn btn-secondary', onClick: handleAddRow }, 'Add Another Subject'),
                React.createElement('button', { key: 'save', className: 'btn', disabled: isLoading, onClick: handleSubmit }, isLoading ? 'Fetching...' : 'Save & Start Learning')
            ])
        ])
    );
};

const PlaylistView = ({ subject, updateSubject, goBack }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [playingVideo, setPlayingVideo] = useState(null);

    // Debounce search input (300ms delay)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const filtered = useMemo(() => {
        if (!debouncedSearch) return subject.videos;
        return subject.videos.filter(v => (v.title || '').toLowerCase().includes(debouncedSearch.toLowerCase()));
    }, [debouncedSearch, subject.videos]);

    const durationStats = useMemo(() => {
        const totalSeconds = subject.videos.reduce((sum, v) => sum + (v.durationSeconds || 0), 0);
        const watchedSeconds = subject.videos.reduce((sum, v) => sum + (v.timeSpent || v.watchTime || 0), 0);
        const toHhMm = (secs) => {
            secs = Math.floor(secs);
            const h = Math.floor(secs / 3600);
            const m = Math.floor((secs % 3600) / 60);
            return `${h}h ${m}m`;
        };
        return { totalSeconds, watchedSeconds, totalHuman: toHhMm(totalSeconds), watchedHuman: toHhMm(watchedSeconds) };
    }, [subject.videos]);

    const updateVideo = (videoId, props) => {
        const updated = subject.videos.map(v => v.id === videoId ? { ...v, ...props } : v);
        updateSubject({ ...subject, videos: updated });
    };

    const progress = useMemo(() => {
        const completedCount = subject.videos.filter(v => v.status === 'Completed').length;
        return (completedCount / (subject.videos.length || 1)) * 100;
    }, [subject.videos]);

    useEffect(() => {
        const onOpen = (e) => {
            setPlayingVideo({ id: e.detail.videoId, watchTime: 0 });
        };
        window.addEventListener('open-player', onOpen);
        return () => window.removeEventListener('open-player', onOpen);
    }, []);

    return (
        React.createElement('div', null, [
            React.createElement('button', { key: 'back', className: 'btn btn-secondary', onClick: goBack }, '← Back to Subjects'),
            // Duration stat cards for this playlist
            React.createElement('div', { key: 'stats', className: 'grid', style: { marginTop: '1rem' } }, [
                React.createElement(StatCard, { key: 'ts', value: durationStats.totalHuman, label: 'Total Duration' }),
                React.createElement(StatCard, { key: 'ws', value: durationStats.watchedHuman, label: 'Watched Duration' })
            ]),
            React.createElement('div', { key: 'header', className: 'playlist-header' }, [
                React.createElement('h1', { key: 'h1', style: { marginTop: '1.5rem' } }, subject.name),
                React.createElement('h2', { key: 'h2' }, subject.playlistTitle),
                React.createElement('p', { key: 'p' }, `Progress: ${progress.toFixed(0)}%`),
                React.createElement('div', { key: 'pbc', className: 'progress-bar-container' },
                    React.createElement('div', { className: 'progress-bar', style: { width: `${progress}%` } })
                )
            ]),
            React.createElement('div', { key: 'controls', className: 'playlist-controls' }, [
                React.createElement('input', { key: 's', type: 'text', placeholder: 'Search videos...', className: 'search-bar', value: searchTerm, onChange: e => setSearchTerm(e.target.value) })
            ]),
            React.createElement('div', { key: 'grid', className: 'grid' },
                filtered.map(video => (
                    React.createElement('div', { key: video.id, className: 'card video-card' }, [
                        React.createElement('div', { key: 'thumb', className: 'video-thumbnail-container' },
                            React.createElement('img', { className: 'video-thumbnail', alt: video.title, src: `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`, loading: 'lazy' })
                        ),
                        React.createElement('div', { key: 'info', className: 'video-info' }, [
                            React.createElement('p', { key: 'title', className: 'video-title' }, video.title),
                            React.createElement('div', { key: 'actions', className: 'video-actions' }, [
                                React.createElement('button', { 
                                    key: 'complete', 
                                    className: `status-btn ${video.status === 'Completed' ? 'completed' : ''}`, 
                                    onClick: () => updateVideo(video.id, { 
                                        status: 'Completed',
                                        timeSpent: video.durationSeconds || 0
                                    }) 
                                }, video.status === 'Completed' ? 'Completed' : 'Mark as Completed'),
                                React.createElement('button', { key: 'watch', className: 'status-btn watch', onClick: () => { updateVideo(video.id, { status: 'In Progress' }); window.dispatchEvent(new CustomEvent('open-global-player', { detail: { id: video.id, title: video.title, watchTime: video.watchTime || 0, subjectId: subject.id } })); } }, 'Watch')
                            ])
                        ])
                    ])
                ))
            )
        ])
    );
};

const App = () => {
    const [subjects, setSubjects] = useLocalStorage('lectureLaneSubjects', []);
    const [currentView, setView] = useState('dashboard');
    const [selectedSubjectId, setSelectedSubjectId] = useState(null);
    const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    const [theme, setTheme] = useLocalStorage('lectureLaneTheme', 'dark');

    // Apply theme on mount and when it changes
    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const updateSubject = (updatedSubject) => {
        setSubjects(prev => prev.map(s => s.id === updatedSubject.id ? updatedSubject : s));
    };

    const onSetupComplete = (newSubjects) => {
        setSubjects(prev => {
            const existing = Array.isArray(prev) ? prev.slice() : [];
            const combined = existing.slice();
            newSubjects.forEach(ns => {
                // Ensure a unique id (slug) so we don't overwrite existing subjects
                const base = ns.id;
                let id = base;
                let idx = 1;
                while (combined.some(s => s.id === id)) {
                    id = `${base}-${idx++}`;
                }
                combined.push({ ...ns, id });
            });
            return combined;
        });
        setView('dashboard');
    };

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 768) {
                setSidebarOpen(true);
            } else {
                setSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const channel = new BroadcastChannel('lecturelane-progress');
        channel.onmessage = (e) => {
            const msg = e.data || {};
            if (!msg || !subjects.length) return;
            if (msg.type === 'progress') {
                setSubjects(prev => {
                    const updated = prev.map(s => ({
                        ...s,
                        videos: s.videos.map(v => {
                            if (v.id === msg.id) {
                                const currentTimeSpent = v.timeSpent || 0;
                                const delta = msg.delta || 0;
                                const newTimeSpent = currentTimeSpent + delta;
                                console.log('Updating video time:', {
                                    videoId: v.id,
                                    currentTimeSpent,
                                    delta,
                                    newTimeSpent,
                                    currentTime: msg.currentTime,
                                    duration: msg.duration
                                });
                                
                                const duration = msg.duration || v.durationSeconds || 0;
                                const remaining = Math.max(0, (duration || 0) - (msg.currentTime || 0));
                                const isNearEndBySeconds = duration > 0 ? remaining <= 30 : false;
                                const isNearlyCompleteFallback = !duration && msg.duration && msg.currentTime && (msg.currentTime >= msg.duration * 0.9);

                                const isCompleted = isNearEndBySeconds || isNearlyCompleteFallback;

                                const finalTimeSpent = isCompleted ? Math.max(newTimeSpent, duration || 0) : newTimeSpent;

                                return {
                                    ...v,
                                    watchTime: msg.currentTime,
                                    timeSpent: finalTimeSpent,
                                    durationSeconds: duration || v.durationSeconds,
                                    status: isCompleted ? 'Completed' : 'In Progress'
                                };
                            }
                            return v;
                        })
                    }));
                    console.log('Updated subjects:', updated.map(s => ({
                        name: s.name,
                        videos: s.videos.map(v => ({
                            id: v.id,
                            timeSpent: v.timeSpent,
                            status: v.status
                        }))
                    })));
                    return updated;
                });
            } else if (msg.type === 'ended') {
                setSubjects(prev => prev.map(s => ({
                    ...s,
                    videos: s.videos.map(v => {
                        if (v.id === msg.id) {
                            const duration = msg.duration || v.durationSeconds || 0;
                            console.log('Video ended:', {
                                videoId: v.id,
                                duration,
                                currentTimeSpent: v.timeSpent
                            });
                            return {
                                ...v,
                                watchTime: duration,
                                timeSpent: duration,
                                durationSeconds: duration,
                                status: 'Completed'
                            };
                        }
                        return v;
                    })
                })));
            }
        };
        return () => channel.close();
    }, [subjects.length]);

    const selectedSubject = useMemo(
        () => subjects.find(s => s.id === selectedSubjectId),
        [subjects, selectedSubjectId]
    );

    useEffect(() => {
        const handler = (e) => {
            const params = new URLSearchParams({ 
                id: e.detail.id, 
                t: Math.floor(e.detail.watchTime || 0), 
                title: e.detail.title || '',
                subjectId: e.detail.subjectId || ''
            });
            window.open(`/app/?player=1&${params.toString()}`, '_blank');
        };
        window.addEventListener('open-global-player', handler);
        return () => window.removeEventListener('open-global-player', handler);
    }, []);

    const renderView = () => {
        if ((subjects || []).length === 0 || currentView === 'setup') {
            return React.createElement(SetupScreen, { onSave: onSetupComplete });
        }
        switch (currentView) {
            case 'dashboard':
                // Dashboard only: overall stats
                return React.createElement(DashboardOnly, { subjects, onAddClick: () => setView('setup'), goSubjects: () => setView('subjects') });
            case 'subjects':
                // Subjects listing
                return React.createElement(SubjectsList, { 
                    subjects,
                    setView,
                    onOpenSubject: (id) => { setSelectedSubjectId(id); setView('playlist'); }
                });
            case 'playlist':
                return selectedSubject ? React.createElement(PlaylistView, { subject: selectedSubject, updateSubject, goBack: () => setView('subjects') }) : React.createElement('div', null, 'Subject not found');
            case 'progress':
                return React.createElement(ProgressView, { subjects });
            case 'settings':
                return React.createElement(SettingsView, { subjects, setSubjects, setView });
            default:
                return React.createElement(DashboardOnly, { subjects, onAddClick: () => setView('setup'), goSubjects: () => setView('subjects') });
        }
    };

    const isPlayerWindow = window.location.search.includes('player=1');
    return React.createElement(React.Fragment, null, [
        (!isPlayerWindow && subjects.length > 0) ? React.createElement('button', { key: 'menu', className: 'menu-toggle', onClick: () => setSidebarOpen(!isSidebarOpen) }, '☰') : null,
        (!isPlayerWindow && subjects.length > 0) ? React.createElement(Sidebar, { key: 'sidebar', currentView, setView, isSidebarOpen, theme, toggleTheme }) : null,
        React.createElement('main', { key: 'main', className: 'main-content' },
            React.createElement('div', { className: 'content-area' }, isPlayerWindow ? React.createElement(PlayerShell) : renderView())
        )
    ]);
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(React.createElement(App));


