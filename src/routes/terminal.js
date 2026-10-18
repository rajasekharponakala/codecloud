/**
 * WebSocket bridge between xterm.js in the browser and a TTY `docker exec` in the lab.
 * Client → server: JSON text frames {type:'input', data} | {type:'resize', cols, rows}.
 * Server → client: binary frames with raw terminal output, then a close frame on exit.
 */
export async function terminalRoutes(app, { labs }) {
  app.get('/lab-sessions/:sessionId/terminal', { websocket: true }, async (socket, request) => {
    // Browsers always send Origin on WebSocket upgrades; rejecting foreign origins stops
    // cross-site WebSocket hijacking with the learner's session cookie.
    const origin = request.headers.origin;
    if (origin && new URL(origin).host !== request.headers.host) return socket.close(1008, 'origin not allowed');

    const user = request.session.get('user');
    if (!user) return socket.close(1008, 'sign in first');

    const pendingInput = [];
    let shell;
    socket.on('message', (raw, isBinary) => {
      if (isBinary) return;
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (message.type === 'input' && typeof message.data === 'string') {
        if (shell) shell.stream.write(message.data);
        else pendingInput.push(message.data);
      } else if (message.type === 'resize' && shell) {
        const cols = Math.min(Math.max(Number(message.cols) | 0, 10), 500);
        const rows = Math.min(Math.max(Number(message.rows) | 0, 5), 200);
        shell.resize(cols, rows);
      }
    });

    try {
      const cols = Number(request.query.cols) || 120;
      const rows = Number(request.query.rows) || 30;
      shell = await labs.openTerminal(user.id, request.params.sessionId, { cols, rows });
    } catch (err) {
      request.log.warn({ err }, 'terminal unavailable');
      return socket.close(1011, String(err.message ?? 'terminal unavailable').slice(0, 120));
    }

    for (const data of pendingInput.splice(0)) shell.stream.write(data);
    shell.stream.on('data', (chunk) => {
      if (socket.readyState === socket.OPEN) socket.send(chunk, { binary: true });
    });
    shell.stream.on('end', () => socket.close(1000, 'shell exited'));
    shell.stream.on('error', () => socket.close(1011, 'shell error'));
    socket.on('close', () => shell.stream.destroy());
  });
}
