const fetch = require('node-fetch');
const { promisify } = require('util');
const writeFile = promisify(require('fs').writeFile);
const readFile = promisify(require('fs').readFile);

const token = 'putYourTokenHere';
const url = `https://api.telegram.org/bot${token}/`;
const startBotTime = new Date('2019/03/06 00:00:00 GMT+0430 (Iran Daylight Time)');
const endTime = new Date('2019/05/06 00:00:00 GMT+0430 (Iran Daylight Time)');
let lstOffset = 0;
const idToUsers = new Map();

process.on('unhandledRejection', (up) => { throw up; });


function div(t, x) {
  return Math.floor(t / x);
}

const secret = {
  password: 'passwordeAdmin',
};

const constants = {
  messages: {
    welcome: msg => `سلام ${msg}. به سامانه آزمون گیر شاز خوش آمدید.`,
    error: '?این چه پیامی است',
  },
};

async function saveBackup() {
  let data = { users: [] };
  for (const user of idToUsers.values()) {
    data.users.push(user);
  }
  data = JSON.stringify(data);
  await writeFile(`backups/b${(new Date()).valueOf()}.json`, data);
  await writeFile('dat.json', data);
}

function milisecondToFarsi(time) {
  let t = time;
  t = div(t, 1000);
  let s = '';
  if (t <= 0) return s;
  s = `${t % 60} ثانیه ${s}`;
  t = div(t, 60);
  if (t <= 0) return s;
  s = `${t % 60} دقیقه و ${s}`;
  t = div(t, 60);
  if (t <= 0) return s;
  s = `${t % 24} ساعت و ${s}`;
  t = div(t, 24);
  if (t <= 0) return s;
  s = `${t % 30} روز و ${s}`;
  t = div(t, 30);
  return s;
}


async function sendMessage(id, text, { keyboard, hideKeyboard = false }) {
  let replyMarkup;
  if (keyboard != null) replyMarkup = { keyboard };
  if (hideKeyboard) replyMarkup = { hide_keyboard: true };
  let res = await fetch(`${url}sendMessage`, {
    method: 'POST',
    body: JSON.stringify({
      chat_id: id,
      text,
      reply_markup: replyMarkup,
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  res = await res.json();
  if (res.ok !== true) {
    console.log(res);
  }
  return res;
}

async function forwardMessage(id, msg) {
  console.log(msg);
  let res = await fetch(`${url}forwardMessage`, {
    method: 'POST',
    body: JSON.stringify({
      chat_id: id,
      from_chat_id: msg.chat.id,
      message_id: msg.message_id,
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  res = await res.json();
  if (res.ok !== true) {
    console.log(res);
  }
  return res;
}


const contest = [
  {
    type: 'option',
    nam: 'تستی',
    duration: 3.5,
    answer: '-',
    problem: [
      { nam: '1', score: 4 },
      { nam: '2', score: 4 },
      { nam: '3', score: 4 },
      { nam: '4', score: 4 },
      { nam: '5', score: 4 },
      { nam: '6', score: 4 },
      { nam: '7', score: 4 },
      { nam: '8', score: 4 },
      { nam: '9', score: 4 },
      { nam: '10', score: 4 },
      { nam: '11', score: 4 },
      { nam: '12', score: 4 },
      { nam: '13', score: 4 },
      { nam: '14', score: 4 },
      { nam: '15', score: 4 },
      { nam: '16', score: 4 },
      { nam: '17', score: 4 },
      { nam: '18', score: 4 },
      { nam: '19', score: 4 },
      { nam: '20', score: 4 },
    ],
  },
  {
    type: 'hand',
    nam: 'تشریحی',
    duration: 4,
    problem: [
      { nam: '1الف', score: 100 },
      { nam: '1ب', score: 100 },
      { nam: '1ج', score: 100 },
      { nam: '2', score: 100 },
      { nam: '3', score: 100 },
      { nam: '4', score: 100 },
    ],
  },
];


const initUserContest = () => contest.map(c => ({
  problem: c.problem.map(() => ({
    answer: (c.type === 'option' ? 0 : undefined),
    score: 0,
    sahihState: 'noAnswer',
  })),
}));


class User {
  constructor({
    state = 'init', nowContest = 0, realName, id, isAdmin = false, contest = initUserContest(), startTime = startBotTime,
  }) {
    this.state = state;
    this.id = id;
    this.isAdmin = isAdmin;
    this.picker = { on: false };
    this.contest = contest;
    this.realName = realName;
    this.nowContest = nowContest;
    this.startTime = new Date(startTime);
  }

  reset() {
    this.state = 'init';
    this.contest = initUserContest();
    this.nowContest = 0;
  }

  getFinalScore(id) {
    let res = 0;
    if (contest[id].type === 'option') {
      if (contest[id].answer === '-') {
        return 'هنوز معلوم نیست.';
      }
      this.contest[id].problem.forEach((p, i) => {
        const score = (ans, jdg, sc) => {
          if (ans === 0) return 0;
          if (String(ans) === jdg) return sc;
          return -sc / 4;
        };
        res += score(p.answer, contest[id].answer[i], contest[id].problem[i].score);
      });
      return res;
    }
    for (const p of this.contest[id].problem) {
      if (p.sahihState === 'notDone' || p.sahihState === 'doing') {
        return 'هنوز معلوم نیست.';
      }
      res += p.score;
    }
    return res;
  }

  getAllScore() {
    return this.contest.map((x, i) => this.getFinalScore(i)).reduce((a, b) => (a === 'هنوز معلوم نیست.' || b === 'هنوز معلوم نیست.' ? 'هنوز معلوم نیست.' : a + b));
  }

  renderNatije() {
    const finalScore = this.getAllScore();
    const fhand = (x, i) => `نمره آزمون ${contest[i].nam}:${this.getFinalScore(i)}\n${x.problem.map((y, j) => {
      if (y.sahihState === 'noAnswer') {
        return `سوال ${contest[i].problem[j].nam} : ${y.score} از ${contest[i].problem[j].score} ( سفید )\n`;
      }
      if (y.sahihState === 'notDone') {
        return `سوال ${contest[i].problem[j].nam} : صحیح نشده\n`;
      }
      if (y.sahihState === 'doing') {
        return `سوال ${contest[i].problem[j].nam} : در حال تصحیح\n`;
      }
      return `سوال ${contest[i].problem[j].nam} : ${y.score} از ${contest[i].problem[j].score}\n`;
    })}`;
    const foption = (x, i) => {
      let res = `نمره آزمون ${contest[i].nam}:${this.getFinalScore(i)}\n`;
      if (contest[i].answer !== '-') {
        res += x.problem.map((y, j) => {
          if (y.answer === 0) {
            return `سوال ${contest[i].problem[j].nam} : ◻️ پاسخ درست ${contest[i].answer[j]}`;
          }
          if (`${y.answer}` === contest[i].answer[j]) {
            return `سوال ${contest[i].problem[j].nam} : ✅ پاسخ شما ${contest[i].answer[j]}`;
          }
          return `سوال ${contest[i].problem[j].nam} : ❌ پاسخ شما ${y.answer} پاسخ درست ${contest[i].answer[j]}`;
        }).join('\n');
      }
      return res;
    };
    return `نتیجه شما:\nنمره نهایی شما: ${finalScore}\n${this.contest.map((x, i) => {
      if (contest[i].type === 'option') return foption(x, i);
      return fhand(x, i);
    })}`;
  }

  inAzmoonKeyboard() {
    const baze = (l, r) => new Array(r - l)
      .fill()
      .map((_, i) => ({ text: contest[this.nowContest].problem[i + l].nam }));
    const jadval = n => new Array(div(n + 4, 5))
      .fill()
      .map((_, i) => baze(i * 5, Math.min(n, i * 5 + 5)));
    return [...jadval(contest[this.nowContest].problem.length), [{ text: 'وضعیت آزمون' }]];
  }

  async finishContest() {
    this.state = 'before_azmoon';
    this.nowContest += 1;
    const keyboard = (this.nowContest === contest.length
      ? [[{ text: 'نتیجه را بگو' }]]
      : [[{ text: 'چقدر مونده؟' }]]
    );
    await this.sendMessage('وقت شما به پایان رسید', { keyboard });
  }

  async forwardMessage(msg) {
    return forwardMessage(this.id, msg);
  }

  async sendMessage(text, options) {
    if (options == null) {
      return sendMessage(this.id, text, {});
    }
    return sendMessage(this.id, text, options);
  }

  async handleInit() {
    this.state = 'start';
    await this.sendMessage('خوش آمدید. نام و نام خانوادگی خود را وارد کنید ( برای گرفتن پیتزا باید شناسنامه بیاورید)');
  }

  async handleStart(msg) {
    const farsiNameChecker = x => (x.match(/[a-z,A-Z]/) == null && x.match(/ /) != null);
    if (!farsiNameChecker(msg)) {
      await this.sendMessage('لطفا نام و نام خانوادگی خود را به صورت فارسی و کامل وارد نمایید');
      return;
    }
    this.realName = msg;
    this.state = 'waiting';
    const keyboard = [[{ text: 'چقدر مونده؟' }]];
    await this.sendMessage(constants.messages.welcome(msg), { keyboard });
  }

  async handleWaiting() {
    if (startBotTime - (new Date()) < 0) {
      this.state = 'before_azmoon';
      return this.handleBeforeAzmoon('چقدر مونده؟');
    }
    this.state = 'waiting';
    const keyboard = [[{ text: 'چقدر مونده؟' }]];
    await this.sendMessage(`${milisecondToFarsi(startBotTime - (new Date()))} به زمان آزمون مانده است.`, { keyboard });
  }

  async handleBeforeAzmoon(msg) {
    if (this.nowContest === contest.length) {
      await this.sendMessage(this.renderNatije());
      return;
    }
    if (msg === 'آزمون را شروع کن.') {
      this.startTime = new Date();
      this.state = 'in_azmoon';
      await Promise.all([
        this.sendMessage('آزمون شروع شد', { keyboard: this.inAzmoonKeyboard() }),
        (contest[this.nowContest].soorat == null)
          ? this.sendMessage('صورت سوالات در دسترس نیست.')
          : this.forwardMessage(contest[this.nowContest].soorat),
      ]);
      return;
    }
    const keyboard = [[{ text: 'آزمون را شروع کن.' }, { text: 'چقدر مونده؟' }]];
    const matn = contest.map((x, i) => {
      if (i < this.nowContest) return '';
      return `آزمون ${x.nam} ${x.duration} ساعته ،\n`;
    }).reduce((a, b) => a + b);
    await this.sendMessage(
      `${milisecondToFarsi(endTime - (new Date()))} به پایان مهلت آزمون مانده است.
:آزمون های پیش رو
${matn}در هر بازه ${contest[this.nowContest].duration} ساعته می توانید آزمون را شروع کنید.`, { keyboard },
    );
  }

  async handleInAzmoon(msg) {
    const rmTime = () => contest[this.nowContest].duration * 60 * 60 * 1000
      - (new Date() - this.startTime);
    if (rmTime() < 0) {
      await this.finishContest();
      return;
    }
    if (msg === 'وضعیت آزمون') {
      let answers = '';
      if (contest[this.nowContest].type === 'option') { answers = this.contest[this.nowContest].problem.map((x, i) => `سوال ${contest[this.nowContest].problem[i].nam}: پاسخ شما ${(x.answer === 0 ? 'نزده' : x.answer)}\n`); }
      await this.sendMessage(`${milisecondToFarsi(rmTime())}از وقت شما باقی مانده است.\n${answers}`);
      return;
    }
    const id = contest[this.nowContest].problem.findIndex(x => x.nam === msg);
    if (id !== -1) {
      const optionKeyboard = (contest[this.nowContest].type === 'hand'
        ? { hideKeyboard: true }
        : {
          keyboard: [
            [{ text: '1' }, { text: '2' }, { text: '3' }, { text: '4' }, { text: '5' }],
            [{ text: 'نزده' }],
          ],
        }
      );
      await this.sendMessage(`پاسخ خود را در قالب یک پیام برای سوال ${msg} ارسال کنید.`, optionKeyboard);
      this.picker.on = true;
      this.picker.send = async (m) => {
        if (rmTime() < 0) {
          await this.finishContest();
          return;
        }
        if (contest[this.nowContest].type === 'option') {
          let msgText = m.text;
          if (msgText === 'نزده') msgText = '0';
          if (!(msgText).match(/^\d+$/)) {
            await this.sendMessage(`پاسخ شما به کلی نادیده گرفته شد. پاسخ باید عددی بین 0 تا 5 باشد اما ${msgText} است.`, { keyboard: this.inAzmoonKeyboard() });
            return;
          }
          const jv = Number(msgText);
          if (jv < 0 || jv > 5) {
            await this.sendMessage(`پاسخ شما به کلی نادیده گرفته شد. پاسخ باید بین 0 تا 5 باشد اما ${msgText} است.`, { keyboard: this.inAzmoonKeyboard() });
            return;
          }
          this.contest[this.nowContest].problem[id].answer = jv;
          await this.sendMessage('پاسخ شما ثبت شد.', { keyboard: this.inAzmoonKeyboard() });
          return;
        }
        this.contest[this.nowContest].problem[id].answer = m;
        this.contest[this.nowContest].problem[id].sahihState = 'notDone';
        await this.sendMessage('پاسخ شما ثبت شد.', { keyboard: this.inAzmoonKeyboard() });
      };
      return;
    }
    if (contest[this.nowContest].type === 'option') {
      let prs = msg.match(/\d+:\d+/g);
      if (prs != null) {
        prs = prs.map(x => x.split(':'));
        for (const q of prs) {
          const ind = contest[this.nowContest].problem.findIndex(x => x.nam === q[0]);
          if (ind === -1) {
            await this.sendMessage(`پاسخ شما به کلی نادیده گرفته شد. سوال ${q[0]} وجود ندارد.`);
            return;
          }
          if (!(q[1].match(/^\d+$/))) {
            await this.sendMessage(`پاسخ شما به کلی نادیده گرفته شد. پاسخ باید بین 0 تا 5 باشد اما ${q[1]} است.`);
            return;
          }
          const jv = Number(q[1]);
          if (jv < 0 || jv > 5) {
            await this.sendMessage(`پاسخ شما به کلی نادیده گرفته شد. پاسخ باید بین 0 تا 5 باشد اما ${q[1]} است.`);
            return;
          }
        }
        for (const q of prs) {
          const ind = contest[this.nowContest].problem.findIndex(x => x.nam === q[0]);
          const jv = Number(q[1]);
          this.contest[this.nowContest].problem[ind].answer = jv;
        }
        await this.sendMessage(`پاسخ ${prs.length} سوال با موفقیت تغییر یافت`);
        return;
      }
      prs = msg.split('');
      if (prs.length === contest[this.nowContest].problem.length) {
        for (const x of prs) {
          if (!(x.match(/^\d+$/))) {
            await this.sendMessage(`پاسخ شما به کلی نادیده گرفته شد. پاسخ باید بین 0 تا 5 باشد اما ${x} است.`);
            return;
          }
          const jv = Number(x);
          if (jv < 0 || jv > 5) {
            await this.sendMessage(`پاسخ شما به کلی نادیده گرفته شد. پاسخ باید بین 0 تا 5 باشد اما ${x} است.`);
            return;
          }
        }
        prs.forEach((x, i) => {
          this.contest[this.nowContest].problem[i].answer = x;
        });
        await this.sendMessage('پاسخ تمامی سوالات با موفقیت تغییر یافت');
        return;
      }
    }
    await this.sendMessage(constants.messages.error);
  }

  async handleAdmin(message) {
    const msg = message.split(' ');
    if (msg[0] === 'resetMe') {
      this.reset();
      await this.sendMessage('done');
      return;
    }
    if (msg[0] === 'eval') {
      const txt = msg.slice(1).join(' ');
      // eslint-disable-next-line no-eval
      eval(txt);
      return;
    }
    if (msg[0] === 'cat') {
      await this.sendMessage(msg[1]);
      return;
    }
    if (msg[0] === 'backup') {
      await saveBackup();
      await this.sendMessage('done');
      return;
    }
    if (msg[0] === 'setSoorat') {
      await this.sendMessage('soorato bede');
      this.picker.on = true;
      this.picker.send = async (m) => {
        contest[msg[1]].soorat = m;
        await this.sendMessage('soorat tanzim shod');
      };
      return;
    }
    if (msg[0] === 'scoreboard') {
      const pm = [...idToUsers.values()].map(x => ({
        nam: x.realName,
        score: x.getAllScore(),
      })).sort((a, b) => {
        if (a.score === b.score) return 0;
        if (a.score === 'هنوز معلوم نیست') return -1;
        if (b.score === 'هنوز معلوم نیست') return 1;
        return b.score - a.score;
      }).map((a, i) => `${i + 1}. ${a.nam} --- ${a.score}`).join('\n');
      await this.sendMessage(pm);
      return;
    }
    if (msg[0] === 'pick') {
      for (const u of idToUsers.values()) {
        const p = u.contest[msg[1]].problem[msg[2]];
        if (p.answer != null && p.sahihState === 'notDone') {
          p.sahihState = 'doing';
          await this.forwardMessage(p.answer);
          this.picker.on = true;
          this.picker.send = async (m) => {
            const mt = m.text;
            if (!(mt.match(/^\d+$/))) {
              p.sahihState = 'notDone';
              await this.sendMessage('cancel shod');
              return;
            }
            p.sahihState = 'Done';
            p.score = Number(mt);
            await this.sendMessage('nomre tanzim shod');
          };
          return;
        }
      }
      await this.sendMessage('tashihe in soal kamel shode :)');
      return;
    }
    await this.sendMessage('error');
  }

  async handleMessage(msg) {
    if (this.picker.on) {
      this.picker.on = false;
      return this.picker.send(msg);
    }
    let msgText = msg.text;
    if (typeof msgText !== 'string') {
      msgText = '';
    }
    if (msgText[0] !== '' && msgText[0] === '$') {
      msgText = msgText.substr(1);
      if (this.isAdmin) {
        return this.handleAdmin(msgText);
      }
      if (msgText === secret.password) {
        await this.sendMessage('تبریک میگم شما ادمین شدید.');
        this.isAdmin = true;
        return;
      }
      await this.sendMessage(constants.messages.error);
      return;
    }
    if (this.state === 'init') {
      return this.handleInit();
    }
    if (this.state === 'start') {
      return this.handleStart(msgText);
    }
    if (this.state === 'waiting') {
      return this.handleWaiting();
    }
    if (this.state === 'before_azmoon') {
      return this.handleBeforeAzmoon(msgText);
    }
    if (this.state === 'in_azmoon') {
      return this.handleInAzmoon(msgText);
    }
    await this.sendMessage('Not Implemented Yet');
  }
}

async function loadBackup() {
  let data = await readFile('dat.json');
  data = JSON.parse(data);
  data.users.forEach((element) => {
    const u = new User(element);
    idToUsers.set(u.id, u);
  });
}

function handleError(e) {
  console.log(e);
  for (const u of idToUsers.values()) {
    if (u.isAdmin) {
      u.sendMessage(`${e}`);
    }
  }
}

async function loop() {
  let res = await fetch(`${url}getUpdates`, {
    method: 'POST',
    body: JSON.stringify({
      offset: lstOffset + 1,
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  res = await res.json();
  res = res.result;
  await Promise.all(res.map(async (element) => {
    lstOffset = element.update_id;
    console.log(element);
    const { id } = element.message.chat;
    if (!idToUsers.has(id)) {
      idToUsers.set(id, new User({ id }));
    }
    const user = idToUsers.get(id);
    await user.handleMessage(element.message);
  }));
}

async function main() {
  await loadBackup();
  for (;;) {
    try {
      await loop();
    } catch (e) {
      handleError(e);
    }
  }
}

main();
