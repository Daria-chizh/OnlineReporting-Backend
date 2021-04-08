const http = require('http');
const Koa = require('koa');
const cors = require('@koa/cors');
const { Transform } = require('stream');
const EventEmitter = require('events');

const app = new Koa();

app.use(cors());

const timeline = [];

function formatDateElement(dateElement) {
  return String(dateElement).padStart(2, '0');
}

function renderCreatedTime() {
  const date = new Date();
  const timePart = `${formatDateElement(date.getHours())}:${formatDateElement(date.getMinutes())}:${formatDateElement(date.getSeconds())}`;
  const shortYear = date.getFullYear().toString().substr(2, 2);
  const datePart = `${formatDateElement(date.getDate())}.${formatDateElement(date.getMonth() + 1)}.${shortYear}`;
  return `${datePart} ${timePart}`;
}

function generateAction() {
  const prob = Math.random();
  if (prob < 0.1) {
    return { timestamp: renderCreatedTime(), text: 'Отличный удар! И Г-О-Л!', type: 'goal' };
    // new Date().toISOString()
  }

  if (prob >= 0.1 && prob < 0.5) {
    return { timestamp: renderCreatedTime(), text: 'Нарушение правил, будет штрафной удар', type: 'freekick' };
  }

  return { timestamp: renderCreatedTime(), text: 'Идёт перемещение мяча по полю, игроки и той, и другой команды активно пытаются атаковать', type: 'action' };
}

class SSEStream extends Transform {
  constructor() {
    super({ writableObjectMode: true });
  }

  _transform(data, _encoding, done) {
    this.push(`data: ${JSON.stringify(data)}\n\n`);
    done();
  }
}

const gameEvents = new EventEmitter();

app.use((ctx) => {
  if (ctx.path !== '/sse') {
    ctx.response.status = 404;
    return;
  }

  const sseStream = new SSEStream();
  const onGameEvent = (event) => sseStream.write(event);
  gameEvents.on('event', onGameEvent);
  sseStream.on('close', () => gameEvents.off('event', onGameEvent));

  ctx.request.socket.setTimeout(0);
  ctx.req.socket.setNoDelay(true);
  ctx.req.socket.setKeepAlive(true);

  ctx.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  ctx.status = 200;
  ctx.body = sseStream;

  for (const event of timeline) {
    sseStream.write(event);
  }
});

function sendGameEvent() {
  const action = generateAction();
  console.log('New game event!', action);
  timeline.push(action);
  gameEvents.emit('event', action);

  if (timeline.length < 50) {
    const delay = Math.floor(Math.random() * 60 * 1000); // delay for 0 .. 1 minute
    console.log(`Next event would be generated in ${delay}ms`);
    setTimeout(() => sendGameEvent(), delay);
  }
}

http.createServer(app.callback()).listen(process.env.PORT || 5555, () => {
  console.log('Server is working');
  sendGameEvent();
});
