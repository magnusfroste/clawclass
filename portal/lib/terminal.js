'use strict';
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const { docker } = require('./docker');

// Short-lived one-time tokens: token → { container, user, expires }
const tokenStore = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [t, e] of tokenStore) if (e.expires < now) tokenStore.delete(t);
}, 60_000);

function createTerminalToken(container, user, cols, rows) {
  const token = crypto.randomBytes(16).toString('hex');
  tokenStore.set(token, { type: 'terminal', container, user, cols: cols || 220, rows: rows || 50, expires: Date.now() + 30_000 });
  return token;
}

function createLogToken(container) {
  const token = crypto.randomBytes(16).toString('hex');
  tokenStore.set(token, { type: 'logs', container, expires: Date.now() + 30_000 });
  return token;
}

function createWss() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', async (ws, entry) => {
    if (entry.type === 'logs') {
      return handleLogStream(ws, entry.container);
    }
    const { container, user, cols, rows } = entry;
    let execStream;
    let execInstance;

    try {
      const c = docker.getContainer(container);
      execInstance = await c.exec({
        Cmd: ['/bin/bash'],
        AttachStdin: true, AttachStdout: true, AttachStderr: true,
        Tty: true, User: user,
        Env: ['TERM=xterm-256color', 'COLORTERM=truecolor'],
      });

      execStream = await execInstance.start({ hijack: true, stdin: true });

      // Set initial terminal size immediately so TUI apps (opencode etc.) start
      // with correct dimensions instead of the default 80×24.
      execInstance.resize({ h: rows, w: cols }).catch(() => {});

      // Docker TTY → browser (binary frames)
      // Coalesce chunks that arrive in the same I/O tick so that escape
      // sequences (e.g. \x1bN, \x1bV) are never split across WS frames.
      let pending = null;
      execStream.on('data', chunk => {
        if (pending === null) {
          pending = chunk;
          setImmediate(() => {
            if (ws.readyState === 1) ws.send(pending, { binary: true });
            pending = null;
          });
        } else {
          pending = Buffer.concat([pending, chunk]);
        }
      });
      execStream.on('end', () => {
        if (ws.readyState === 1) ws.close(1000, 'Process exited');
      });

      // Browser → Docker TTY
      ws.on('message', (msg, isBinary) => {
        if (!isBinary) {
          // JSON control message (resize)
          try {
            const p = JSON.parse(msg.toString());
            if (p.type === 'resize' && execInstance) {
              execInstance.resize({ h: p.rows, w: p.cols }).catch(() => {});
            }
          } catch {}
        } else if (execStream && !execStream.destroyed) {
          execStream.write(msg);
        }
      });

      ws.on('close', () => { try { execStream?.end(); } catch {} });
      ws.on('error', () => { try { execStream?.destroy(); } catch {} });

    } catch (e) {
      console.error('[terminal] error:', e.message);
      if (ws.readyState === 1) ws.close(1011, e.message.slice(0, 123));
    }
  });

  return wss;
}

async function handleLogStream(ws, containerName) {
  try {
    const container = docker.getContainer(containerName);
    const stream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      tail: 100,
      timestamps: true,
    });

    stream.on('data', chunk => {
      if (ws.readyState === 1) {
        // Parse Docker log stream format (8-byte header)
        let offset = 0;
        while (offset + 8 <= chunk.length) {
          const size = chunk.readUInt32BE(offset + 4);
          offset += 8;
          if (offset + size > chunk.length) break;
          const line = chunk.slice(offset, offset + size).toString('utf8');
          ws.send(JSON.stringify({ type: 'log', data: line }));
          offset += size;
        }
      }
    });

    stream.on('end', () => {
      if (ws.readyState === 1) ws.close(1000, 'Container stopped');
    });

    stream.on('error', err => {
      if (ws.readyState === 1) ws.close(1011, err.message.slice(0, 123));
    });

    ws.on('close', () => {
      try { stream.destroy(); } catch {}
    });

  } catch (e) {
    console.error('[logs] error:', e.message);
    if (ws.readyState === 1) ws.close(1011, e.message.slice(0, 123));
  }
}

module.exports = { createWss, createTerminalToken, createLogToken, tokenStore };
